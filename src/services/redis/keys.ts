export const redisKeys = {
  projectInvite: (email: string) => `project-invite-${email}`,
  projectInvites: (projectId: string | number) => `project-invites-${projectId}`,
  newEmail: (newEmail: string) => `new-email-${newEmail}`,
  forgotEmail: (email: string) => `forgot-email-${email}`,
  teamInvite: (email: string) => `team-invite-${email}`,
  userNotifications: (userId: string | number) => `user-notifications-${userId}`,
  notifications: (notificationId: string | number) => `notifications-${notificationId}`,
}