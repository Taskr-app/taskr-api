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
} from "type-graphql";
import { Task } from "../entity/Task";
import { List } from "../entity/List";
import { isAuth } from "./middleware";
import { User } from "../entity/User";
import { uniqBy } from "lodash";

const topics = {
  create: "CREATE_TASK",
  update: "UPDATE_TASK",
  delete: "DELETE_TASK",
  addMember: "ADD_TASK_MEMBER",
  removeMember: "REMOVE_TASK_MEMBER"
}

@Resolver()
export class TaskResolver {
  @Query(() => [Task])
  @UseMiddleware(isAuth)
  async getListTasks(@Arg("listId", () => ID) listId: number) {
    try {
      const list = await List.findOne({
        relations: ["tasks"],
        where: { id: listId }
      });
      if (!list) throw new Error(`This list doesn't exist`);
      return list.tasks
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Task)
  @UseMiddleware(isAuth)
  async createTask(
    @PubSub(topics.create) publish: Publisher<Task>,
    @Arg("listId", () => ID) listId: number,
    @Arg("name") name: string,
    @Arg("desc", { nullable: true }) desc?: string
  ) {
    try {
      const list = await List.findOne({
        relations: ['project'],
        where: { id: listId }
      });
      if (!list) throw new Error(`This list doesn't exist`);
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
    @Arg("id", () => ID) id: number,
    @Arg("listId", () => ID, { nullable: true }) listId: number,
    @Arg("name", { nullable: true }) name: string,
    @Arg("desc", { nullable: true }) desc: string,
    @Arg("dueDate", { nullable: true }) dueDate: Date
  ) {
    try {
      const task = await Task.findOne({ where: { id } })
      if (!task) throw new Error(`This task doesn't exist`)
      if (listId) {
        const list = await List.findOne({ where: { id: listId } })
        if (!list) throw new Error(`This list doesn't exist`)
        task.list = list
      }
      task.name = name ? name : task.name
      task.desc = desc ? desc : task.desc
      task.dueDate = dueDate ? dueDate : task.dueDate
      const newTask = await task.save()
      await publish(newTask)
      return newTask
    } catch (err) {
      console.log(err)
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deleteTask(
    @PubSub(topics.delete) publish: Publisher<Task>,
    @Arg("taskId", () => ID) taskId: number
  ) {
    try {
      const task = await Task.findOne({ where: { id: taskId } })
      if (!task) throw new Error(`This task doesn't exist`)
      await publish(task)
      await task.remove()
      return true
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async addTaskMember(
    @PubSub(topics.addMember) publish: Publisher<Task>,
    @Arg("id", () => ID) id: number,
    @Arg('userId', () => ID) userId: number
  ) {
    try {
      const task = await Task.findOne({ where: { id } })
      if (!task) throw new Error(`This task doesn't exist`)
      const user = await User.findOne({ where: { id: userId } })
      if (!user) throw new Error(`This user doesn't exist`)
      task.users = uniqBy([...task.users, user], 'id');
      await publish(task);
      await task.save();
      return true;
    } catch (err) {
      console.log(err)
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
      const task = await Task.findOne({ where: { id } })
      if (!task) throw new Error(`This task doesn't exist`)
      const user = await User.findOne({ where: { id: userId } })
      if (!user) throw new Error(`This user doesn't exist`);
      task.users = task.users.filter(user => user.id !== parseInt(userId))
      await publish(task)
      await task.save();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Subscription(() => Task, {
    topics: topics.create,
    filter: ({ payload, args }) => args.listId === payload.list.id
  })
  newTask(@Root() task: Task, @Arg("listId", () => Int) _listId: number) {
    return task;
  }

  @Subscription(() => Task, {
    topics: topics.update,
    filter: ({ payload, args }) => args.taskId === payload.id
  })
  updatedTask(
    @Root() updatedTask: Task,
    @Arg("taskId", () => Int) _taskId: number
  ) {
    return updatedTask
  }

  @Subscription(() => Task, {
    topics: topics.delete,
    filter: ({ payload, args }) => {
      console.log(payload, args)
      return args.taskId === payload.id
    }
  })
  deletedTask(
    @Root() deletedTask: Task,
    @Arg("taskId", () => Int) _taskId: number
  ) {
    return deletedTask
  }

  @Subscription(() => Task, {
    topics: topics.addMember,
    filter: ({ payload, args }) => args.taskId === payload.id
  })
  addedTaskMember(
    @Root() addedTaskMember: Task,
    @Arg("taskId", () => Int) _taskId: number
  ) {
    return addedTaskMember
  }

  @Subscription(() => Task, {
    topics: topics.removeMember,
    filter: ({ payload, args }) => args.taskId === payload.id
  })
  removedTaskMember(
    @Root() removeTaskMember: Task,
    @Arg("taskId", () => Int) _taskId: number
  ) {
    return removeTaskMember
  }
}
