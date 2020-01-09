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
  JoinTable
} from 'typeorm';
import { List } from './List';
import { Label } from './Label';
import { Project } from './Project';
import { User } from './User';

@ObjectType()
@Entity('tasks')
export class Task extends BaseEntity {
  @BeforeInsert()
  async generatePos() {
    const maxPosTask = await Task.findOne({
      order: {
        id: 'DESC'
      },
      where: {
        list: this.list.id
      }
    });
    this.pos = maxPosTask ? maxPosTask.pos + 16384 : 16384;
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
      cascade: ['insert', 'update'],
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
      eager: true
    }
  )
  @JoinTable()
  users: User[];
}
