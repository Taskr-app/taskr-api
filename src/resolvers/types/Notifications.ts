import { Field, ID, ObjectType } from "type-graphql";
import { redis } from "../../services/redis";
import { v4 } from "uuid";

/**
 * red-skeys: `notifications-<id>` & `user-notifications-<userId>`
 *
 * @id (number) auto incremented key for redis
 * @date (Date) date notification was created
 * @userId (number) id of the user that created the action
 * @type (string) action type ie. createTeam, createProject, deleteProject
 *
 * @create (({ userId: number, type: string }) => true) creates a notification in redis
 * @remove ((notificationId: number, userId: number) => true) removes a notification in redis
 * @getAll ((userId: number, range: number)) get notifications from 0 - range from a specific user
 * @get (function) get a single notification by id
 */

@ObjectType()
export class Notifications {
  @Field(() => ID)
  id: string;

  @Field()
  date: Date;

  @Field(() => ID)
  userId: number;

  @Field()
  type: string;

  @Field()
  read: boolean;

  static async create<T extends Pick<Notifications, "userId" | "type">>({
    userId,
    type
  }: T): Promise<Boolean> {
    try {
      const notificationId = v4();
      const notification = await redis.hmset(
        `notifications-${notificationId}`,
        {
          id: notificationId,
          userId,
          type,
          date: Date.now(),
          read: false
        }
      );
      if (!notification) throw new Error("Failed to set notification");
      const userNotifications = await redis.lpush(
        `user-notifications-${userId}`,
        notificationId
      );
      if (!userNotifications)
        throw new Error(`Failed to set user notifications`);

      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  static async getAll<T extends Pick<Notifications, "userId">>(
    { userId }: T,
    range: number = 10
  ): Promise<Notifications[]> {
    try {
      const notificationIds = await redis.lrange(
        `user-notifications-${userId}`,
        0,
        range
      );
      const notifications: Notifications[] = await notificationIds.reduce(
        async (notifications: Notifications[], notificationId: number) => {
          const notification = await redis.hgetall(
            `notifications-${notificationId}`
          );
          if (!Object.keys(notification).length) {
            await redis.lrem(`user-notifications-${userId}`, 1, notificationId)
            return notifications;
          } else {
            return [
              ...notifications,
              {
                ...notification,
                read: notification.read === "true" ? true : false
              }
            ];
          }
        },
        Promise.resolve([])
      );

      return notifications;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  static async remove(notificationId: number, userId: number) {
    try {
      const notification = await redis.del(`notifications-${notificationId}`);
      if (!notification) throw new Error(`This notification doesn't exist`);
      const userNotifications = await redis.lrem(
        `user-notifications-${userId}`,
        1,
        notificationId
      );
      if (!userNotifications)
        throw new Error(`User notifications doesn't exist`);
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }
}
