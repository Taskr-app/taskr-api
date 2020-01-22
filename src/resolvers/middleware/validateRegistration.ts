import { MiddlewareFn } from 'type-graphql';
import { redis } from '../../services/redis';
import { redisProjects } from '../../services/redis/projects';
import { MyContext } from '../../services/context';

export interface RegistrationContext extends MyContext {
  password?: string;
}

export const validateRegistration: MiddlewareFn<RegistrationContext> = async (
  { args, context },
  next
) => {
  try {
    const { email, verificationLink, registerKey } = args;
    if (!registerKey) {
      const { link, password } = await redis.hgetall(email);

      if (verificationLink !== link) {
        throw new Error('This link has expired or has already been used');
      }

      context.password = password;
      return next();
    }

    if (registerKey.includes('project-invites')) {
      const id = registerKey.match(/([^\-]+$)/)[0];
      const storedEmail = redisProjects.get({
        email,
        link: verificationLink,
        id
      });
      if (!storedEmail) {
        throw new Error('Thsi link has expired or has already been used');
      } else {
        return next();
      }
    }
  } catch (err) {
    return err;
  }
  return next();
};
