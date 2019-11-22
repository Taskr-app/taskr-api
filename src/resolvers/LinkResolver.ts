import { Resolver, Query, Arg, ID, Mutation } from "type-graphql";
import { redis } from "../services/redis";
import { generateProjectLink } from "../services/links";
import { Notifications } from "./types/Notifications";

@Resolver()
export class LinkResolver {
  @Query(() => Boolean)
  async validateLink(@Arg("key") key: string, @Arg("link") link: string) {
    try {
      const { link: storedLink } = await redis.hgetall(key);
      if (!link || storedLink !== link) {
        throw new Error(`This link has expired`);
      }
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Query(() => Boolean)
  async validatePublicProjectLink(
    @Arg("projectId", () => ID) projectId: number,
    @Arg("link") link: string
  ) {
    try {
      const validatorLink = generateProjectLink(projectId);
      if (link !== validatorLink) {
        throw new Error(`This link has expired`);
      }
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  async createNotification(
    @Arg('userId', () => ID) userId: number
  ) {
    try {
      await Notifications.create({
        userId,
        type: 'test'
      })
  
      return true
    } catch (err) {
      console.log(err)
      return err;
    }
  }

  @Mutation(() => [Notifications])
  async getNotifications(
    @Arg('userId', () => ID) userId: number
  ) {
    try {
      const notifications = await Notifications.getAll({ userId })
      if (!notifications) throw new Error(`Notifications doesn't exist`)
      return notifications
    } catch (err) {
      console.log(err);
      return err;
    }
  }
}
