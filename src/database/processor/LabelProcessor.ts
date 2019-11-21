import { IProcessor } from 'typeorm-fixtures-cli';
import { Label } from '../../entity/Label';

export default class LabelProcessor implements IProcessor<Label> {
  public colors = ["#f56a00", "#7265e6", "#ffbf00", "#00a2ae"];
  async preProcess(_name: string, object: any): Promise<any> {
    const color = this.colors[Math.floor(Math.random()*this.colors.length)]
    return { ...object, color };
  }
}
