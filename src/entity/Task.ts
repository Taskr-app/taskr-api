import { ObjectType, Field, ID } from 'type-graphql';
import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  BeforeInsert,
  ManyToMany,
  JoinTable,
  BeforeRemove
} from 'typeorm';
import { List } from './List';
import { Label } from './Label';
import { Project } from './Project';
import { User } from './User';
import { buffer } from '../services/constants';

@ObjectType()
@Entity('tasks')
export class Task extends BaseEntity {
  @BeforeInsert()
  async increaseListMaxPos() {
    try {
      this.list.maxPos += buffer;
      await this.list.save();
      this.pos = this.list.maxPos;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @BeforeRemove()
  async decreaseListMaxPos() {
    if (this.pos === this.list.maxPos) {
      this.list.maxPos -= buffer;
      await this.list.save();
    }
  }

  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column()
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  desc: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  dueDate: Date;

  @Field()
  @Column({ type: 'double precision' })
  pos: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Field(() => List)
  @ManyToOne(
    () => List,
    list => list.tasks,
    {
      eager: false,
      onDelete: 'CASCADE',
      nullable: false
    }
  )
  list: List;

  @Field(() => Project)
  @ManyToOne(() => Project, {
    nullable: false
  })
  project: Project;

  @ManyToMany(
    () => Label,
    label => label.tasks
  )
  @JoinTable()
  labels: Label[];

  @Field(() => [User])
  @ManyToMany(
    () => User,
    user => user.tasks,
    {
      // eager: true
    }
  )
  @JoinTable()
  users: User[];
}
