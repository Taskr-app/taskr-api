import { Mutation, Arg, ID, Query, Resolver } from "type-graphql";
import { Notifications } from "./types/Notifications";


@Resolver()
export class NotificationsResolver {
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

  @Query(() => [Notifications])
  async getNotifications(
    @Arg('userId', () => ID) userId: number
  ) {
    try {
      const notifications = await Notifications.find({ userId })
      if (!notifications) throw new Error(`Notifications doesn't exist`)
      return notifications
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Query(() => Notifications)
  async getNotification(
    @Arg('id', () => ID) id: string
  ) {
    try {
      const notification = await Notifications.findOne({ id })
      console.log('notification: ', notification)
      return notification
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  async deleteNotification(
    @Arg('id', () => ID) id: string
  ) {
    try {
      const notification = await Notifications.findOne({ id })
      await notification.remove()
      return true
    } catch (err) {
      console.log(err);
      return err;
    }
  }
}