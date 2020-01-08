import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  // ManyToMany,
  // JoinTable,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from 'type-graphql';
import { Project } from './Project';
import { Team } from './Team';
import { Task } from './Task';

export enum UserAuthType {
  WEBSITE = 'website',
  GOOGLE = 'google'
}
registerEnumType(UserAuthType, {
  name: 'UserAuthType',
  description: 'User auth type for auth column (WEBSITE | GOOGLE)'
});

@ObjectType()
@Entity('users')
export class User extends BaseEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Field()
  @Column()
  username: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  avatar: string;

  @Column('int', { default: 0 })
  tokenVersion: number;

  @Field(() => UserAuthType)
  @Column({
    type: 'enum',
    enum: UserAuthType,
    default: UserAuthType.WEBSITE
  })
  auth: UserAuthType;

  @Field()
  @CreateDateColumn()
  created_at: Date;

  @Field()
  @UpdateDateColumn()
  updated_at: Date;

  @Field(() => [Project])
  @OneToMany(
    () => Project,
    project => project.owner,
    {
      cascade: true,
      eager: true
    }
  )
  ownedProjects: Project[];

  @Field(() => [Team])
  @OneToMany(
    () => Team,
    team => team.owner,
    {
      cascade: true
    }
  )
  ownedTeams: Team[];

  @Field(() => [Project])
  @ManyToMany(
    () => Project,
    project => project.members
  )
  @JoinTable()
  projects: Project[];

  @Field(() => [Team])
  @ManyToMany(
    () => Team,
    team => team.members
  )
  @JoinTable()
  teams: Team[];

  @Field(() => [Task])
  @ManyToMany(
    () => Task,
    task => task.users
  )
  tasks: Task[];
}
