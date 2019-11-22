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
 * @find (({ userId: number }, range: [number, number]) => Promise<Notificatoins>[]) get notifications from 0 - range from a specific user
 * @create (({ userId: number, type: string }) => true) creates a notification in redis
 * @remove ((notificationId: number, userId: number) => true) removes a notification in redis
 */

interface NotificationsArg {
  id: string;
  date: Date;
  userId: number;
  type: string;
  read: boolean;
}

@ObjectType()
export class Notifications {
  constructor({ id, date, userId, type, read }: NotificationsArg) {
    this.id = id;
    this.date = date;
    this.userId = userId;
    this.type = type;
    this.read = read;
  }

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

  static async find<T extends Pick<Notifications, "userId">>(
    { userId }: T,
    range: [number, number] = [0, 10]
  ): Promise<Notifications[]> {
    try {
      const notificationIds = await redis.lrange(
        `user-notifications-${userId}`,
        range[0],
        range[1]
      );
      const notifications: Notifications[] = await notificationIds.reduce(
        async (notifications: Notifications[], notificationId: number) => {
          const notification = await redis.hgetall(
            `notifications-${notificationId}`
          );
          if (!Object.keys(notification).length) {
            await redis.lrem(`user-notifications-${userId}`, 1, notificationId);
            return await notifications;
          } else {
            redis.expire(`notifications-${notificationId}`, 604800);
            const notificationClass = new Notifications({
              ...notification,
              read: notification.read === "true" ? true : false
            })

            return [
              ...(await notifications),
              notificationClass
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

  static async findOne<T extends Pick<Notifications, "id">>({
    id
  }: T): Promise<Notifications> {
    try {
      const notification = await redis.hgetall(`notifications-${id}`);
      if (!notification || !Object.keys(notification).length) {
        throw new Error(`This notification doesn't exist`);
      }
      return new Notifications({
        ...notification,
        read: notification.read === "true" ? true : false
      });
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  async remove() {
    try {
      const removedNotification = await redis.del(`notifications-${this.id}`)
      if (!removedNotification) throw new Error(`Could not delete notification`)
      const removedUserNotification = await redis.lrem(`user-notifications-${this.userId}`, 1, this.id)
      if (!removedUserNotification) throw new Error(`Could not delete user notification`)
      return true
    } catch (err) {
      console.log(err);
      return err;
    }
  }
}
