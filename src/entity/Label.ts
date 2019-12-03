import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
} from 'typeorm';
import { ObjectType, Field, ID } from 'type-graphql';
import { Project } from './Project';
import { Task } from './Task';
import { HexColor } from '../resolvers/types/HexColor';

@ObjectType()
@Entity('labels')
export class Label extends BaseEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field(() => HexColor)
  @Column()
  color: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Field(() => Project)
  @ManyToOne(() => Project, project => project.labels)
  project: Project;

  @ManyToMany(() => Task, task => task.labels)
  tasks: Task[];
}
