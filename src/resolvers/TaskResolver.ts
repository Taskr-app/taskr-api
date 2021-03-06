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
  Query,
  Field,
  ArgsType,
  Args,
  InputType,
  ObjectType
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

@InputType()
class TaskInput {
  @Field(() => ID)
  id: string;
  @Field()
  pos: number;
}

@InputType()
class MovedTaskInput extends TaskInput {
  @Field(() => ID)
  listId: string;
}

@ArgsType()
class UpdateTaskArgs {
  @Field(() => MovedTaskInput)
  taskMoved: MovedTaskInput;

  @Field(() => [TaskInput], { nullable: true })
  moreTasks?: TaskInput[];
}

@ObjectType()
class TaskWithPosResponse {
  @Field(() => ID)
  id: string;
  @Field()
  pos: number;
}

// @ObjectType()
// class MovedTaskResponse extends TaskWithPosResponse {
//   @Field(() => ID, { nullable: true })
//   listId?: string;
// }

@ObjectType()
class PublishTasksResult {
  @Field(() => Task)
  task: Task;

  @Field(() => [TaskWithPosResponse], { nullable: true })
  moreTasks?: TaskWithPosResponse[];
}

@ArgsType()
class PublishTasksArgs {
  @Field(() => Task)
  task: Task;

  @Field(() => ID)
  sourceListId: number;

  @Field(() => [TaskInput], { nullable: true })
  moreTasks?: TaskInput[];
}

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
    @PubSub(topics.move) publish: Publisher<PublishTasksArgs>,
    @Args(() => UpdateTaskArgs)
    { taskMoved, moreTasks }: UpdateTaskArgs
  ) {
    const { id, pos, listId } = taskMoved;
    const task = await createQueryBuilder(Task, 'task')
      .leftJoinAndSelect('task.list', 'list')
      .where('"task"."id" = :id', { id })
      .getOne();
    if (!task) throw new Error(`Task with id ${id} does not exist`);
    task.pos = pos;
    const sourceListId = task.list.id;

    // Task is moving to another list
    if (parseInt(listId) !== task.list.id) {
      const listToMoveTo = await createQueryBuilder(List, 'list')
        .where('"list"."id" = :listId', { listId })
        .orderBy('list.pos', 'ASC')
        .getOne();
      if (!listToMoveTo) {
        throw new Error('List does not exist');
      }
      task.list = listToMoveTo;
    }

    // Update entire list of tasks
    if (moreTasks && moreTasks.length) {
      const queriedTasks = (task.list.tasks = await createQueryBuilder(
        Task,
        'task'
      )
        .where('"task"."listId" = :id', { id: task.list.id })
        .orderBy('task.pos', 'ASC')
        .getMany());

      moreTasks.forEach(moreTask => {
        const taskToBeUpdated = queriedTasks.find(
          listTask => listTask.id === parseInt(moreTask.id)
        );
        taskToBeUpdated!.pos = moreTask.pos;
      });
    }

    await task.save();
    if (task.list) await task.list.save();
    await publish({ task, sourceListId, moreTasks });
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

  @Subscription(() => PublishTasksResult, {
    topics: topics.move,
    filter: ({
      payload,
      args
    }: {
      payload: PublishTasksArgs;
      args: { listId: string };
    }) => {
      try {
        if (!payload.task || !payload.task.list)
          throw new Error('Invalid payload');
        return (
          payload.task.list.id === parseInt(args.listId) ||
          payload.sourceListId === parseInt(args.listId)
        );
      } catch (err) {
        console.log(err);
        return false;
      }
    }
  })
  onTaskMoved(
    @Root() payload: PublishTasksArgs,
    @Arg('listId', () => ID) _: string
  ): PublishTasksResult {
    return payload;
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
