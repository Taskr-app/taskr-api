import { ObjectType, Field, ID, ArgsType } from 'type-graphql';

@ObjectType()
export class InvitedUserResponse {
  @Field()
  email: string;

  @Field({ nullable: true })
  avatar?: string;
}

@ObjectType()
export class InvitedUserSubscriptionPayload {
  @Field()
  email: string;

  @Field(() => ID)
  projectId: number;

  @Field({ nullable: true })
  avatar?: string;
}

@ArgsType()
export class AcceptedUserSubscriptionPayload {
  @Field(() => ID)
  projectId: number;
}