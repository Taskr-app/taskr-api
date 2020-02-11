import { createBaseResolver } from './BaseResolver';
import {
  Resolver,
  Mutation,
  UseMiddleware,
  Arg,
  ID,
  PubSubEngine,
  PubSub,
  Subscription,
  Root,
  Query,
  Publisher,
  ArgsType,
  Field
} from 'type-graphql';
import { List } from '../entity/List';
import { Project } from '../entity/Project';
import { createQueryBuilder } from 'typeorm';
import { isAuth } from './middleware/isAuth';
import { buffer } from '../services/constants';

const ListBaseResolver = createBaseResolver('List', List);

const topics = {
  create: 'CREATE_LIST',
  update: 'UPDATE_LIST',
  delete: 'DELETE_LIST',
  move: 'MOVE_LIST'
};

@ArgsType()
class PublisherPayloadArgs {
  @Field(() => [List])
  lists: List[];
  @Field(() => ID)
  projectId: number;
}

@Resolver()
export class ListResolver extends ListBaseResolver {
  @Mutation(() => List)
  @UseMiddleware(isAuth)
  async createList(
    @Arg('projectId', () => ID) projectId: string,
    @Arg('name') name: string,
    @PubSub() pubSub: PubSubEngine
  ) {
    const project = await Project.findOne({ where: { id: projectId } });
    if (!project) {
      throw new Error('Project does not exist');
    }

    const list = await List.create({
      name,
      project,
      tasks: []
    }).save();
    await pubSub.publish(topics.create, list);
    return list;
  }

  @Mutation(() => List)
  @UseMiddleware(isAuth)
  async deleteList(
    @PubSub(topics.delete) publish: Publisher<List>,
    @Arg('id', () => ID) id: string
  ) {
    const list = await createQueryBuilder(List, 'list')
      .leftJoinAndSelect('list.project', 'project')
      .where('"list"."id" = :id', { id })
      .getOne();
    if (!list) {
      throw new Error('Could not find List');
    }
    await publish(list);
    await list.remove();
    return list;
  }

  @Subscription({
    topics: topics.create,
    filter: ({ payload, args }) =>
      payload.project.id === parseInt(args.projectId)
  })
  onListCreated(
    @Root() list: List,
    @Arg('projectId', () => ID) _: string
  ): List {
    return list;
  }

  @Subscription({
    topics: topics.delete,
    filter: ({ payload, args }) => {
      return payload.project.id === parseInt(args.projectId);
    }
  })
  onListDeleted(
    @Root() list: List,
    @Arg('projectId', () => ID) _: string
  ): List {
    return list;
  }

  @Subscription({
    topics: topics.update,
    filter: ({ payload, args }) =>
      payload.project.id === parseInt(args.projectId)
  })
  onListUpdated(
    @Root() list: List,
    @Arg('projectId', () => ID) _: string
  ): List {
    return list;
  }

  @Subscription(() => [List], {
    topics: topics.move,
    filter: ({
      payload,
      args
    }: {
      payload: PublisherPayloadArgs;
      args: { projectId: string };
    }) => {
      try {
        return payload.projectId === parseInt(args.projectId);
      } catch (err) {
        console.log(err);
        return false;
      }
    }
  })
  onListMoved(
    @Root() payload: PublisherPayloadArgs,
    @Arg('projectId', () => ID) _: string
  ): List[] {
    return payload.lists;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async updateListName(
    @Arg('id', () => ID) id: number,
    @Arg('name') name: string
  ) {
    const list = await List.findOne({ where: { id } });
    if (!list) {
      throw new Error('List does not exist');
    }
    list.name = name;
    await list.save();
    return true;
  }

  @Mutation(() => [List])
  @UseMiddleware(isAuth)
  async updateListPos(
    @PubSub(topics.move) publish: Publisher<PublisherPayloadArgs>,
    @Arg('id', () => ID) id: string,
    @Arg('aboveId', () => ID, { nullable: true }) aboveId?: string,
    @Arg('belowId', () => ID, { nullable: true }) belowId?: string
  ) {
    if (aboveId === undefined && belowId === undefined) {
      return false;
    }
    try {
      if (aboveId === undefined && belowId === undefined) {
        return false;
      }
      const targetList = await createQueryBuilder(List, 'list')
        .leftJoinAndSelect('list.project', 'project')
        .where('"list"."id" = :id', { id })
        .getOne();

      if (!targetList) {
        throw new Error('List does not exist');
      }
      let publishLists: List[] = [];

      // move target to bottom of list
      if (belowId === undefined) {
        targetList.pos = targetList.project.maxPos + buffer;
      }

      // move target to top of list
      else if (aboveId === undefined) {
        // get pos of first list
        const firstList = targetList.project.lists.find(list => {
          return list.id === parseInt(belowId);
        });
        if (!firstList) {
          throw new Error('First list does not exist');
        }
        targetList.pos = firstList.pos / 2;
      }

      // move target to bottom of list
      if (belowId === undefined) {
        targetList.pos = targetList.project.maxPos + buffer;
        targetList.project.maxPos = targetList.pos;
        await targetList.project.save();
        publishLists = [targetList];
      }

      // move target to top of list
      else if (aboveId === undefined && belowId) {
        targetList.project.lists = await createQueryBuilder(List, 'list')
          .where('"list"."projectId" = :id', { id: targetList.project.id })
          .orderBy('list.pos', 'ASC')
          .getMany();
        const firstList = targetList.project.lists[0];

        targetList.pos =
          Math.round((firstList.pos / 2 + Number.EPSILON) * 1) / 1;
        publishLists = [targetList];

        // collision handling
        if (firstList.pos <= 1) {
          targetList.pos = buffer;
          let counter = 1;
          targetList.project.lists.forEach(list => {
            if (list.id === targetList.id) {
              list.pos = buffer;
            } else {
              list.pos = buffer * counter + buffer;
              counter += 1;
            }
          });
          await targetList.project.save();
          publishLists = targetList.project.lists;
        }
      }

      // move target between two lists
      else {
        targetList.project.lists = await createQueryBuilder(List, 'list')
          .where('"list"."projectId" = :id', { id: targetList.project.id })
          .orderBy('list.pos', 'ASC')
          .getMany();

        let aboveList: undefined | List;
        let belowList: undefined | List;
        for (let i = 0; i < targetList.project.lists.length - 1; i += 1) {
          if (targetList.project.lists[i].id === parseInt(aboveId!)) {
            aboveList = targetList.project.lists[i];
            belowList = targetList.project.lists[i + 1];
            break;
          }
        }
        if (!aboveList) throw new Error('Task above does not exist');
        if (!belowList) throw new Error('Task below does not exist');
        if (aboveList.pos === belowList.pos) {
          throw new Error('Neighbor lists have same position values');
        }

        // pos collision handling (between two lists)
        if (Math.abs(aboveList.pos - belowList.pos) <= 1) {
          targetList.pos = Math.ceil(belowList.pos + buffer);
          belowList.pos = Math.ceil(targetList.pos + buffer * 2);

          let targetFound = false;
          targetList.project.lists.forEach(list => {
            if (
              targetFound &&
              !(list.id === targetList.id) &&
              !(list.id === aboveList!.id) &&
              belowList!.pos > list.pos
            ) {
              list.pos = Math.ceil(list.pos + buffer * 2);
              if (list.pos > targetList.project.maxPos) {
                targetList.project.maxPos = list.pos;
              }
            }
            if (list.id === belowList!.id) {
              targetFound = true;
            }
          });
          publishLists = targetList.project.lists;
        } else {
          targetList.pos =
            Math.round(
              ((aboveList.pos + belowList.pos) / 2 + Number.EPSILON) * 1
            ) / 1;
          publishLists = [targetList];
        }
        await targetList.project.save();
      }

      await targetList.save();
      await publish({ projectId: targetList.project.id, lists: publishLists });
      return publishLists;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Query(() => [List])
  @UseMiddleware(isAuth)
  async getProjectListsAndTasks(@Arg('projectId', () => ID) projectId: string) {
    const lists = await createQueryBuilder(List, 'list')
      .where('"list"."projectId" = :id', { id: projectId })
      .leftJoinAndSelect('list.tasks', 'task')
      .orderBy('list.pos, task.pos', 'ASC')
      .getMany();
    return lists;
  }
}
