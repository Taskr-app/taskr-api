import { redis } from '.';
import { redisKeys, redisExpirationDuration, redisSeparator } from './keys';

export type RedisProjectsType = {
  id: string | number;
  link: string;
  email: string;
};

export const projectMember = (email: string, link: string) => `${email}${redisSeparator.project}${link}`;

export const redisProjects = {
  add: async ({ id, link, email }: RedisProjectsType): Promise<boolean> => {
    try {
      const expirationDate = Date.now() + (redisExpirationDuration * 1000)

      const existingEmail = await redis.zscan(redisKeys.projectInvites(id), 0, 'MATCH', `${email}*`)
      if (existingEmail[1][0]) {
        await redis.zrem(redisKeys.projectInvites(id), existingEmail[1][0])
      }
      await redis.zadd(redisKeys.projectInvites(id), expirationDate.toString(), projectMember(email, link))
      redis.expire(redisKeys.projectInvites(id), redisExpirationDuration)
      return true
    } catch (err) {
      return err;
    }
  },

  get: async ({ id, email, link }: RedisProjectsType): Promise<string> => {
    try {
      await redis.zremrangebyscore(redisKeys.projectInvites(id), -Infinity, Date.now())
      const res = await redis.zscan(redisKeys.projectInvites(id), 0, 'MATCH', projectMember(email, link), 'COUNT', 1)
      if (res && res[0] && res[1]) {
        const [email] = res[1];
        return email
      } else {
        throw new Error('This link has expired or has already been used')
      }
    } catch (err) {
      return err;
    }
  },

  delete: async ({ email, id, link }: RedisProjectsType): Promise<void> => {
    try {
      await redis.zrem(redisKeys.projectInvites(id), projectMember(email, link))
    } catch (err) {
      return err;
    }
  },

  getAll: async ({ id }: Pick<RedisProjectsType, 'id'>) => {
    try {
      await redis.zremrangebyscore(redisKeys.projectInvites(id), -Infinity, Date.now())
      return await redis.zrangebyscore(redisKeys.projectInvites(id), Date.now(), '+inf')
    } catch (err) {
      return err;
    }
  }
};
