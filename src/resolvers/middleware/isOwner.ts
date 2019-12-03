import { Team } from "../../entity/Team";
import { Project } from "../../entity/Project";
import { BaseEntity } from "typeorm";
import { MiddlewareFn } from "type-graphql";
import { MyContext } from "../../services/context";

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
