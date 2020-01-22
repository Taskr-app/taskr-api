import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class InvitedUserResponse {
  @Field()
  email: string;

  @Field({ nullable: true })
  avatar?: string;
}