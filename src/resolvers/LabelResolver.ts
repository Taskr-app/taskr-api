import {
  Resolver,
  Query,
  UseMiddleware,
  Arg,
  ID,
  Mutation,
  Args,
  ArgsType,
  Field
} from "type-graphql";
import { Label } from "../entity/Label";
import { Project } from "../entity/Project";
import { HexColor } from "./types/HexColor";
import { Task } from "../entity/Task";
import { isAuth } from "./middleware";

@ArgsType()
class LabelArgs {
  @Field(() => ID)
  id: number;

  @Field(() => String, { nullable: true })
  name: string;

  @Field(() => HexColor, { nullable: true })
  color: string;
}

interface LabelType {
  name: string;
  color: string;
}

@Resolver()
export class LabelResolver {
  @Query(() => [Label])
  @UseMiddleware(isAuth)
  async getProjectLabels(@Arg("projectId", () => ID) projectId: number) {
    try {
      const project = await Project.findOne({
        relations: ["labels"],
        where: { id: projectId }
      });
      if (!project) throw new Error(`This project doesn't exist`);
      return project.labels;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async createLabel(
    @Arg("projectId", () => ID) projectId: number,
    @Arg("name") name: string,
    @Arg("color", () => HexColor) color: string
  ) {
    try {
      const project = await Project.findOne({ where: { id: projectId } });
      if (!project) throw new Error(`This project doesn't exist`);
      await Label.insert({
        name,
        color,
        project
      });

      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async assignLabel(
    @Arg("taskId", () => ID) taskId: number,
    @Arg("labelId", () => ID) labelId: number
  ) {
    try {
      const label = await Label.findOne({
        relations: ["tasks", "project"],
        where: { id: labelId }
      });
      if (!label) throw new Error(`This label doesn't exist`);
      const task = await Task.findOne({
        relations: ["project"],
        where: { id: taskId }
      });
      if (!task) throw new Error(`This task doesn't exist`);
      if (label.project.id !== task.project.id) {
        throw new Error(`The label or task doesn't exist in the same project`);
      }

      label.tasks = [...label.tasks, task];
      await label.save();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async updateLabel(@Args() { id, ...args }: LabelArgs) {
    try {
      const label = await Label.findOne({ where: { id } });
      if (!label) throw new Error(`This label doesn't exist`);
      const labelArgs = Object.keys(args);
      labelArgs.forEach(arg => {
        label[arg as keyof LabelType] = args[arg as keyof LabelType];
      });
      await label.save();

      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async removeTaskLabel(
    @Arg("labelId", () => ID) labelId: number,
    @Arg("taskId", () => ID) taskId: number
  ) {
    try {
      const label = await Label.findOne({
        relations: ["tasks", "project"],
        where: { id: labelId }
      });
      if (!label) throw new Error(`This label doesn't exist`);
      const task = await Task.findOne({
        relations: ["project"],
        where: { id: taskId }
      });
      if (!task) throw new Error(`This task doesn't exist`);
      if (label.project.id !== task.project.id) {
        throw new Error(`The label or task doesn't exist in the same project`);
      }
      label.tasks = label.tasks.filter(labelTask => labelTask.id !== task.id);
      await label.save();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deleteLabel(@Arg("id", () => ID) id: number) {
    try {
      const label = await Label.findOne({ where: { id } });
      if (!label) throw new Error(`This label doesn't exist`);

      await label.remove();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }
}
