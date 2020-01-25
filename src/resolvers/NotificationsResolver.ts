import {
  Mutation,
  Arg,
  ID,
  Query,
  Resolver,
  UseMiddleware,
  Ctx,
  Subscription,
  Root
} from 'type-graphql';
import { Notifications } from './types/Notifications';
import { MyContext } from '../services/context';
import { isAuth } from './middleware';

export const topics = {
  create: 'CREATE_NOTIFICATION',
  update: 'UPDATE_NOTIFICATION',
  delete: 'DELETE_NOTIFICATION'
};

@Resolver()
export class NotificationsResolver {
  @Mutation(() => Boolean)
  async createNotification(@Arg('userId', () => ID) userId: number) {
    await Notifications.create({
      userId,
      type: 'test'
    });

    return true;
  }

  @Query(() => [Notifications])
  @UseMiddleware(isAuth)
  async getNotifications(@Ctx() { payload }: MyContext) {
    const notifications = await Notifications.find({
      userId: payload!.userId
    });
    if (!notifications) throw new Error('Notifications doesn\'t exist');
    return notifications;
  }

  @Query(() => Notifications)
  async getNotification(@Arg('id', () => ID) id: string) {
    const notification = await Notifications.findOne({ id });
    if (!notification) throw new Error('This notification doesn\'t exist');
    return notification;
  }

  @Mutation(() => Boolean)
  async deleteNotification(@Arg('id', () => ID) id: string) {
    const notification = await Notifications.findOne({ id });
    await notification.remove();
    return true;
  }

  @Subscription(() => Notifications, {
    topics: topics.create
  })
  newNotification(
    @Root() notification: Partial<Notifications>,
    @Arg('userId', () => ID) _userId: number
  ) {
    return {
      ...notification,
      date: notification.date ? new Date(notification.date) : undefined
    };
  }
}
