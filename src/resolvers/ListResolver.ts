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
  Query
} from 'type-graphql';
import { List } from '../entity/List';
import { Project } from '../entity/Project';
import { isAuth } from './middleware/isAuth';
import { createQueryBuilder } from 'typeorm';

const ListBaseResolver = createBaseResolver('List', List);
const buffer = 16384;

const topics = {
  create: 'CREATE_LIST',
  update: 'UPDATE_LIST',
  delete: 'DELETE_LIST',
  move: 'MOVE_LIST'
};

@Resolver()
export class ListResolver extends ListBaseResolver {
  @Mutation(() => List)
  @UseMiddleware(isAuth)
  async createList(
    @Arg('projectId', () => ID) projectId: string,
    @Arg('name') name: string,
    @PubSub() pubSub: PubSubEngine
  ) {
    try {
      const project = await Project.findOne({ where: { id: projectId } });

      if (!project) {
        throw new Error('Project does not exist');
      }

      const list = await List.create({
        name,
        project
      }).save();
      await pubSub.publish(topics.create, list);
      return list;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => List)
  @UseMiddleware(isAuth)
  async deleteList(
    @Arg('id', () => ID) id: string,
    @PubSub() pubSub: PubSubEngine
  ) {
    try {
      const list = await List.findOne({
        where: { id },
        relations: ['project']
      });
      if (!list) {
        throw new Error('Could not find List');
      }
      await pubSub.publish(topics.delete, list);
      list.remove();
      return list;
    } catch (err) {
      console.log(err);
      return err;
    }
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

  @Subscription({
    topics: topics.move,
    filter: ({ payload, args }) =>
      payload.project.id === parseInt(args.projectId)
  })
  onListMoved(@Root() list: List, @Arg('projectId', () => ID) _: string): List {
    return list;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async updateListName(
    @Arg('id', () => ID) id: number,
    @Arg('name') name: string
  ) {
    try {
      const list = await List.findOne({ where: { id } });
      if (!list) {
        throw new Error('List does not exist');
      }
      list.name = name;
      await list.save();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async updateListPos(
    @PubSub() pubSub: PubSubEngine,
    @Arg('id', () => ID) id: string,
    @Arg('aboveId', () => ID, { nullable: true }) aboveId?: string,
    @Arg('belowId', () => ID, { nullable: true }) belowId?: string
  ) {
    try {
      if (aboveId === undefined && belowId === undefined) {
        return false;
      }
      const targetList = await List.findOne({
        relations: ['project'],
        where: { id }
      });
      if (!targetList) {
        throw new Error('List does not exist');
      }

      // move target to bottom of list
      if (belowId === undefined) {
        // get pos of last list
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

      // move target between aboveList and belowList
      else {
        const aboveList = targetList.project.lists.find(
          list => list.id === parseInt(aboveId!)
        );
        if (!aboveList) {
          throw new Error('List above does not exist');
        }
        const belowList = targetList.project.lists.find(
          list => list.id === parseInt(belowId!)
        );
        if (!belowList) {
          throw new Error('List below does not exist');
        }

        targetList.pos = (aboveList.pos + belowList.pos) / 2;
      }
      // TODO check if pos numbers get too close to each other .0001 apart or smth
      // renumber the cards and nearby cards

      await targetList.save();
      await pubSub.publish(topics.move, targetList);
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Query(() => [List])
  @UseMiddleware(isAuth)
  async getProjectLists(@Arg('projectId', () => ID) projectId: string) {
    try {
      const lists = await createQueryBuilder(List, 'lists')
        .where(`"projectId" = :id`, { id: projectId })
        .orderBy('lists.pos', 'ASC')
        .getMany();

      return lists;
    } catch (err) {
      return err;
    }
  }
}
