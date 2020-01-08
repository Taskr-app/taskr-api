import { MiddlewareFn } from 'type-graphql';
import { Notifications } from '../types/Notifications';
import { MyContext } from '../../services/context';
import { pubSub } from '../../services/redis';
import { topics } from '../NotificationsResolver';

export const createNotification: MiddlewareFn<MyContext> = async (
  { context, info },
  next
) => {
  if (!context || !context.payload || !context.payload.userId) {
    throw new Error('Not authenticated');
  }

  await next();

  const notification = await Notifications.create({
    userId: context.payload.userId,
    type: info.fieldName
  });

  if (!notification) throw new Error('Failed to create notification');
  await pubSub.publish(topics.create, notification);
};
