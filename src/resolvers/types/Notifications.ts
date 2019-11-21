import { ObjectType, Field, ID } from "type-graphql";

/**
 * @id (number) auto incremented key for redis
 * @date (Date) date notification was created
 * @userId (number) id of the user that created the action
 * @type (string) action type ie. createTeam, createProject, deleteProject
 * 
 * @create (function) creates a notification in redis
 * @remove (function) removes a notification in redis
 * @getAllByUser (function) get all notifications from a specific user
 * @getAllByType (function) get all notifications of a specific type
 * @getAllByDate (function) get all notifications within a range of time
 * @get (function) get a single notification by id
 */

@ObjectType()
export class Notifications {
  @Field(() => ID)
  id: number

  @Field()
  date: Date

  @Field(() => ID)
  userId: number

  @Field()
  type: string
  
  create() {

  }
}