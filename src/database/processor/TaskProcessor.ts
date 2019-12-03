import { IProcessor } from 'typeorm-fixtures-cli';
import { Task } from '../../entity/Task';

/** Map Task to project using the randomly generated list */

export default class TaskProcessor implements IProcessor<Task> {
  preProcess(_name: string, object: any): any {
    const project = object.list.project
    return { ...object, project }
  }
}