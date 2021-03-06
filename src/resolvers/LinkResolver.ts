import { Resolver, Query, Arg, ID } from 'type-graphql';
import { redis } from '../services/redis';
import { generateProjectLink } from '../services/links';

@Resolver()
export class LinkResolver {
  @Query(() => Boolean)
  async validateLink(@Arg('key') key: string, @Arg('link') link: string) {
    const { link: storedLink } = await redis.hgetall(key);
    if (!link || storedLink !== link) {
      throw new Error('This link has expired');
    }
    return true;
  }

  @Query(() => Boolean)
  async validatePublicProjectLink(
    @Arg('projectId', () => ID) projectId: number,
    @Arg('link') link: string
  ) {
    const validatorLink = generateProjectLink(projectId);
    if (link !== validatorLink) {
      throw new Error('This link has expired');
    }
    return true;
  }
}
