import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  BeforeInsert,
  OneToMany,
  BeforeRemove
} from 'typeorm';
import { ObjectType, Field, ID } from 'type-graphql';
import { Project } from './Project';
import { Task } from './Task';
import { buffer } from '../services/constants';

@ObjectType()
@Entity('lists')
export class List extends BaseEntity {
  @BeforeInsert()
  async increaseProjectMaxPos() {
    try {
      this.project.maxPos += buffer;
      await this.project.save();
      this.pos = this.project.maxPos;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @BeforeRemove()
  async decreaseListMaxPos() {
    if (this.pos === this.project.maxPos) {
      this.project.maxPos -= buffer;
      await this.project.save();
    }
  }

  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column({ type: 'double precision' })
  pos: number;

  @Column({ type: 'double precision', default: 0 })
  maxPos: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Field(() => Project)
  @ManyToOne(
    () => Project,
    project => project.lists,
    {
      onDelete: 'CASCADE',
      nullable: false
    }
  )
  project: Project;

  @Field(() => [Task])
  @OneToMany(
    () => Task,
    task => task.list,
    { cascade: ['insert', 'update'] }
  )
  tasks: Task[];
}
