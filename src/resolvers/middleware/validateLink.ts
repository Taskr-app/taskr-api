import { MiddlewareFn } from 'type-graphql';
import { redisProjects } from '../../services/redis/projects';

export const validateProjectInvitationLink: MiddlewareFn = async ({ args }, next) => {
  try {
    const { id, email, projectInviteLink } = args;
    const validated = await redisProjects.get({ id, email, link: projectInviteLink })
    if (!validated) {
      throw new Error('This link has expired or has already been used')
    }
  } catch (err) {
    return err;
  }
  return next();
}