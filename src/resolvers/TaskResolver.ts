import {
  Resolver,
  UseMiddleware,
  Mutation,
  Arg,
  ID,
  PubSub,
  Subscription,
  Root,
  Publisher,
  Int,
  Query
} from 'type-graphql';
import { Task } from '../entity/Task';
import { List } from '../entity/List';
import { isAuth } from './middleware';
import { User } from '../entity/User';
import { uniqBy } from 'lodash';
import { createQueryBuilder } from 'typeorm';
import { buffer } from '../services/constants';

const topics = {
  create: 'CREATE_TASK',
  update: 'UPDATE_TASK',
  delete: 'DELETE_TASK',
  addMember: 'ADD_TASK_MEMBER',
  removeMember: 'REMOVE_TASK_MEMBER',
  move: 'MOVE_TASK'
};

@Resolver()
export class TaskResolver {
  @Query(() => [Task])
  @UseMiddleware(isAuth)
  async getListTasks(@Arg('listId', () => ID) listId: number) {
    const list = await List.findOne({
      relations: ['tasks'],
      where: { id: listId }
    });
    if (!list) throw new Error('This list doesn\'t exist');
    return list.tasks;
  }

  @Mutation(() => Task)
  @UseMiddleware(isAuth)
  async createTask(
    @PubSub(topics.create) publish: Publisher<Task>,
    @Arg('listId', () => ID) listId: string,
    @Arg('name') name: string,
    @Arg('desc', { nullable: true }) desc?: string
  ) {
    const list = await List.findOne({
      relations: ['project'],
      where: { id: listId }
    });
    if (!list) throw new Error('This list doesn\'t exist');
    const task = await Task.create({
      name,
      desc,
      list,
      project: list.project
    }).save();
    await publish(task);
    return task;
  }

  @Mutation(() => Task)
  @UseMiddleware(isAuth)
  async updateTask(
    @PubSub(topics.update) publish: Publisher<Task>,
    @Arg('id', () => ID) id: number,
    @Arg('listId', () => ID, { nullable: true }) listId: number,
    @Arg('name', { nullable: true }) name: string,
    @Arg('desc', { nullable: true }) desc: string,
    @Arg('dueDate', { nullable: true }) dueDate: Date
  ) {
    const task = await Task.findOne({ where: { id } });
    if (!task) throw new Error('This task doesn\'t exist');
    if (listId) {
      const list = await List.findOne({ where: { id: listId } });
      if (!list) throw new Error('This list doesn\'t exist');
      task.list = list;
    }
    task.name = name ? name : task.name;
    task.desc = desc ? desc : task.desc;
    task.dueDate = dueDate ? dueDate : task.dueDate;
    const newTask = await task.save();
    await publish(newTask);
    return newTask;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async updateTaskPos(
    @PubSub(topics.move) publish: Publisher<Task>,
    @Arg('id', () => ID) id: string,
    @Arg('listId', () => ID, { nullable: true }) listId?: string,
    @Arg('aboveId', () => ID, { nullable: true }) aboveId?: string,
    @Arg('belowId', () => ID, { nullable: true }) belowId?: string
  ) {
    const targetTask = await createQueryBuilder(Task, 'task')
      .leftJoinAndSelect('task.list', 'list')
      .where('"task"."id" = :id', { id })
      .getOne();

    if (!targetTask) {
      throw new Error('Task does not exist');
    }
    if (listId) {
      const newList = await List.findOne({
        relations: ['tasks'],
        where: { id: listId }
      });

      if (!newList) {
        throw new Error('List does not exist');
      }
      targetTask.list = newList;
    }

    // move target to top of list
    else if (aboveId === undefined && belowId) {
      targetTask.list.tasks = await createQueryBuilder(Task, 'task')
        .where('"task"."listId" = :id', { id: targetTask.list.id })
        .getMany();
      // get pos of first task
      const firstTask = targetTask.list.tasks.find(task => {
        return task.id === parseInt(belowId);
      });
      if (!firstTask) {
        throw new Error('First task does not exist');
      }
      // task moving to another list
      if (listId && targetTask.list.id !== parseInt(listId)) {
        const newList = await createQueryBuilder(List, 'list')
          .where('"list"."id" = :listId', { listId })
          .leftJoinAndSelect('list.tasks', 'task')
          .orderBy('list.pos, task.pos', 'ASC')
          .getOne();
        if (!newList) {
          throw new Error('List does not exist');
        }
        targetTask.list = newList;
      }
      // move target to bottom of list or to a list with no tasks
      if (belowId === undefined) {
        targetTask.pos = targetTask.list.maxPos + buffer;
        targetTask.list.maxPos = targetTask.pos;
        await targetTask.list.save();
      }
      targetTask.pos = firstTask.pos / 2;
    }

    // move target to top of list
    else if (aboveId === undefined && belowId) {
      targetTask.list.tasks = await createQueryBuilder(Task, 'task')
        .where('"task"."listId" = :id', { id: targetTask.list.id })
        .orderBy('task.pos', 'ASC')
        .getMany();

      const firstTask = targetTask.list.tasks[0];

      targetTask.pos = Math.round((firstTask.pos / 2 + Number.EPSILON) * 1) / 1;

      // pos collision handling
      if (firstTask.pos <= 1) {
        let counter = 1;
        targetTask.list.tasks.forEach(task => {
          if (task.id === targetTask.id) {
            task.pos = buffer;
          } else {
            task.pos = buffer * counter + buffer;
            counter += 1;
          }
        });
        await targetTask.list.save();
      }
    }

    // move target between two tasks
    else {
      targetTask.list.tasks = await createQueryBuilder(Task, 'task')
        .where('"task"."listId" = :id', { id: targetTask.list.id })
        .orderBy('task.pos', 'ASC')
        .getMany();

      let aboveTask: undefined | Task;
      let belowTask: undefined | Task;
      for (let i = 0; i < targetTask.list.tasks.length - 1; i += 1) {
        if (targetTask.list.tasks[i].id === parseInt(aboveId!)) {
          aboveTask = targetTask.list.tasks[i];
          belowTask = targetTask.list.tasks[i + 1];
          break;
        }
      }
      if (!aboveTask) throw new Error('Task above does not exist');
      if (!belowTask) throw new Error('Task below does not exist');
      if (aboveTask.pos === belowTask.pos)
        throw new Error('Neighbor tasks have same position values');

      // pos collision handling (between two cards)
      // target: (below + buffer) | below: (target + buffer*2) | rest: (rest + buffer*2)
      if (Math.abs(aboveTask.pos - belowTask.pos) <= 1) {
        targetTask.pos = Math.ceil(belowTask.pos + buffer);
        belowTask.pos = Math.ceil(targetTask.pos + buffer * 2);

        let targetFound = false;
        targetTask.list.tasks.forEach(task => {
          if (
            targetFound &&
            !(task.id === targetTask.id) &&
            !(task.id === aboveTask!.id) &&
            belowTask!.pos > task.pos
          ) {
            task.pos = Math.ceil(task.pos + buffer * 2);
            if (task.pos > targetTask.list.maxPos) {
              targetTask.list.maxPos = task.pos;
            }
          }
        });
        await targetTask.list.save();
      } else {
        targetTask.pos =
          Math.round(
            ((aboveTask.pos + belowTask.pos) / 2 + Number.EPSILON) * 1
          ) / 1;
      }
    }
    await targetTask.save();
    await publish(targetTask);
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deleteTask(
    @PubSub(topics.delete) publish: Publisher<Task>,
    @Arg('taskId', () => ID) taskId: number
  ) {
    const task = await Task.findOne({
      where: { id: taskId },
      relations: ['list']
    });
    if (!task) throw new Error('This task doesn\'t exist');
    await publish(task);
    await task.remove();
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async addTaskMember(
    @PubSub(topics.addMember) publish: Publisher<Task>,
    @Arg('id', () => ID) id: number,
    @Arg('userId', () => ID) userId: number
  ) {
    const task = await Task.findOne({ where: { id } });
    if (!task) throw new Error('This task doesn\'t exist');
    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw new Error('This user doesn\'t exist');
    task.users = uniqBy([...task.users, user], 'id');
    await publish(task);
    await task.save();
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async removeTaskMember(
    @PubSub(topics.removeMember) publish: Publisher<Task>,
    @Arg('id', () => ID) id: number,
    @Arg('userId', () => ID) userId: string
  ) {
    const task = await Task.findOne({ where: { id } });
    if (!task) throw new Error('This task doesn\'t exist');
    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw new Error('This user doesn\'t exist');
    task.users = task.users.filter(user => user.id !== parseInt(userId));
    await publish(task);
    await task.save();
    return true;
  }

  @Subscription(() => Task, {
    topics: topics.create,
    filter: ({ payload, args }) => parseInt(args.listId) === payload.list.id
  })
  onTaskCreated(@Root() task: Task, @Arg('listId', () => ID) _listId: string) {
    return task;
  }

  @Subscription(() => Task, {
    topics: topics.delete,
    filter: ({ payload, args }) => parseInt(args.listId) === payload.list.id
  })
  onTaskDeleted(
    @Root() deletedTask: Task,
    @Arg('listId', () => ID) _taskId: string
  ) {
    return deletedTask;
  }

  @Subscription(() => Task, {
    topics: topics.update,
    filter: ({ payload, args }) => parseInt(args.taskId) === payload.id
  })
  onTaskUpdated(
    @Root() updatedTask: Task,
    @Arg('taskId', () => ID) _taskId: string
  ) {
    return updatedTask;
  }

  @Subscription({
    topics: topics.move,
    filter: ({ payload, args }) => {
      if (!payload.list) {
        throw new Error('payload.list doesnt exist');
      }
      return payload.list.id === parseInt(args.listId);
    }
  })
  onTaskMoved(@Root() task: Task, @Arg('listId', () => ID) _: string): Task {
    return task;
  }

  @Subscription(() => Task, {
    topics: topics.addMember,
    filter: ({ payload, args }) => args.taskId === payload.id
  })
  addedTaskMember(
    @Root() addedTaskMember: Task,
    @Arg('taskId', () => Int) _taskId: number
  ) {
    return addedTaskMember;
  }

  @Subscription(() => Task, {
    topics: topics.removeMember,
    filter: ({ payload, args }) => args.taskId === payload.id
  })
  removedTaskMember(
    @Root() removeTaskMember: Task,
    @Arg('taskId', () => Int) _taskId: number
  ) {
    return removeTaskMember;
  }
}
