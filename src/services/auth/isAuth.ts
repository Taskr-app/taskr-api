import { MiddlewareFn } from "type-graphql";
import { MyContext } from "../context";
import { verify } from "jsonwebtoken";
import { verifyIdToken } from "./google";
import { User } from "../../entity/User";
import { Team } from "../../entity/Team";
import { Project } from "../../entity/Project";
import { BaseEntity } from "typeorm";

export const isAuth: MiddlewareFn<MyContext> = async ({ context }, next) => {
  const authorization = context.req.headers["authorization"];
  if (!authorization) {
    throw new Error("Not authenticated");
  }

  try {
    const token = authorization.split(" ")[1];
    let payload = verify(token, process.env.ACCESS_TOKEN_SECRET!) as any;
    const { googleIdToken } = payload;

    // payload contains googleIdToken instead of user
    if (googleIdToken) {
      const googleTokenPayload = await verifyIdToken(googleIdToken);
      if (googleTokenPayload) {
        const user = await User.findOne({ email: googleTokenPayload.email });
        if (!user) {
          throw new Error("User not found");
        }
        payload = { userId: user.id };
      }
    }
    context.payload = payload as any;
  } catch (err) {
    console.log(err);
    return err;
  }
  return next();
};

type OwnerEntity = Team | Project;

/**
 *
 * @param entity The entity used to the find the `owner` property. ie. Team // --> Team.owner
 * @param idArg The argument name used to find the entity instance of the `owner` property. ie. "teamId" // --> Team.findOne({ where: { id: teamId } })
 */

export const isOwner: <T extends typeof BaseEntity>(
  entity: T,
  idArg: string
) => MiddlewareFn<MyContext> = (entity, idArg) => async (
  { context, args },
  next
) => {
  try {
    if (!context || !context.payload || !context.payload.userId) {
      throw new Error(`Not authenticated`);
    }
    const id: string = args[idArg];
    const entityClass = await entity.findOne({
      relations: ["owner"],
      where: { id }
    });

    if (!entityClass) throw new Error(`Entity not found`);
    if (!(entityClass as OwnerEntity).owner) {
      throw new Error(`Owner not found`) 
    }

    if (context.payload.userId !== (entityClass as OwnerEntity).owner.id) {
      throw new Error(`You don't have permissions to access this request`);
    }

    context.entity = entityClass as OwnerEntity
  } catch (err) {
    console.log(err);
    return err;
  }

  return next();
};
