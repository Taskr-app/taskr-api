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

const topics = {
  create: 'CREATE_TASK',
  update: 'UPDATE_TASK',
  delete: 'DELETE_TASK',
  addMember: 'ADD_TASK_MEMBER',
  removeMember: 'REMOVE_TASK_MEMBER',
  move: 'MOVE_TASK'
};

const buffer = 16384;

@Resolver()
export class TaskResolver {
  @Query(() => [Task])
  @UseMiddleware(isAuth)
  async getListTasks(@Arg('listId', () => ID) listId: number) {
    try {
      const list = await List.findOne({
        relations: ['tasks'],
        where: { id: listId }
      });
      if (!list) throw new Error("This list doesn't exist");
      return list.tasks;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Task)
  @UseMiddleware(isAuth)
  async createTask(
    @PubSub(topics.create) publish: Publisher<Task>,
    @Arg('listId', () => ID) listId: string,
    @Arg('name') name: string,
    @Arg('desc', { nullable: true }) desc?: string
  ) {
    try {
      const list = await List.findOne({
        relations: ['project'],
        where: { id: listId }
      });
      if (!list) throw new Error("This list doesn't exist");
      const task = await Task.create({
        name,
        desc,
        list,
        project: list.project
      }).save();
      await publish(task);
      return task;
    } catch (err) {
      console.log(err);
      return err;
    }
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
    try {
      const task = await Task.findOne({ where: { id } });
      if (!task) throw new Error("This task doesn't exist");
      if (listId) {
        const list = await List.findOne({ where: { id: listId } });
        if (!list) throw new Error("This list doesn't exist");
        task.list = list;
      }
      task.name = name ? name : task.name;
      task.desc = desc ? desc : task.desc;
      task.dueDate = dueDate ? dueDate : task.dueDate;
      const newTask = await task.save();
      await publish(newTask);
      return newTask;
    } catch (err) {
      console.log(err);
      return err;
    }
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
    try {
      const targetTask = await Task.findOne({
        relations: ['list'],
        where: { id }
      });
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

      // move target to bottom of list or to a list with no tasks
      if (belowId === undefined) {
        targetTask.pos = targetTask.list.maxPos + buffer;
        targetTask.list.maxPos = targetTask.pos;
      }

      // move target to top of list
      else if (aboveId === undefined) {
        targetTask.list.tasks = await createQueryBuilder(Task, 'task')
          .where(`"task"."listId" = :id`, { id: targetTask.list.id })
          .getMany();
        // get pos of first task
        const firstTask = targetTask.list.tasks.find(task => {
          return task.id === parseInt(belowId);
        });
        if (!firstTask) {
          throw new Error('First task does not exist');
        }
        targetTask.pos = firstTask.pos / 2;
      }

      // move target between aboveTask and belowTask
      else {
        targetTask.list.tasks = await createQueryBuilder(Task, 'task')
          .where(`"task"."listId" = :id`, { id: targetTask.list.id })
          .getMany();
        const aboveTask = targetTask.list.tasks.find(
          task => task.id === parseInt(aboveId!)
        );
        if (!aboveTask) {
          throw new Error('Task above does not exist');
        }
        const belowTask = targetTask.list.tasks.find(
          task => task.id === parseInt(belowId!)
        );
        if (!belowTask) {
          throw new Error('Task below does not exist');
        }

        targetTask.pos = (aboveTask.pos + belowTask.pos) / 2;
      }
      // TODO check if pos numbers get too close to each other .0001 apart or smth
      // renumber the cards and nearby cards

      await targetTask.save();
      await publish(targetTask);
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deleteTask(
    @PubSub(topics.delete) publish: Publisher<Task>,
    @Arg('taskId', () => ID) taskId: number
  ) {
    try {
      const task = await Task.findOne({
        where: { id: taskId },
        relations: ['list']
      });
      if (!task) throw new Error(`This task doesn't exist`);
      await publish(task);
      await task.remove();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async addTaskMember(
    @PubSub(topics.addMember) publish: Publisher<Task>,
    @Arg('id', () => ID) id: number,
    @Arg('userId', () => ID) userId: number
  ) {
    try {
      const task = await Task.findOne({ where: { id } });
      if (!task) throw new Error("This task doesn't exist");
      const user = await User.findOne({ where: { id: userId } });
      if (!user) throw new Error("This user doesn't exist");
      task.users = uniqBy([...task.users, user], 'id');
      await publish(task);
      await task.save();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async removeTaskMember(
    @PubSub(topics.removeMember) publish: Publisher<Task>,
    @Arg('id', () => ID) id: number,
    @Arg('userId', () => ID) userId: string
  ) {
    try {
      const task = await Task.findOne({ where: { id } });
      if (!task) throw new Error("This task doesn't exist");
      const user = await User.findOne({ where: { id: userId } });
      if (!user) throw new Error("This user doesn't exist");
      task.users = task.users.filter(user => user.id !== parseInt(userId));
      await publish(task);
      await task.save();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
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
    filter: ({ payload, args }) => args.taskId === payload.id
  })
  updatedTask(
    @Root() updatedTask: Task,
    @Arg('taskId', () => Int) _taskId: number
  ) {
    return updatedTask;
  }

  @Subscription({
    topics: topics.move,
    filter: ({ payload, args }) => {
      try {
        if (!payload.list) {
          throw new Error('payload.list doesnt exist');
        }
        return payload.list.id === parseInt(args.listId);
      } catch (err) {
        console.log(err);
        return false;
      }
    }
  })
  onTaskMoved(@Root() task: Task, @Arg('listId', () => ID) _: string): Task {
    try {
      return task;
    } catch (err) {
      throw new Error('ontaskmoved fail');
    }
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
