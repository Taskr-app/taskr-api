export const redisKeys = {
  projectInvites: (projectId: string | number) => `project-invites-${projectId}`,
  newEmail: (newEmail: string) => `new-email-${newEmail}`,
  forgotEmail: (email: string) => `forgot-email-${email}`,
  teamInvite: (email: string) => `team-invite-${email}`,
  userNotifications: (userId: string | number) => `user-notifications-${userId}`,
  notifications: (notificationId: string | number) => `notifications-${notificationId}`,
}

export const redisExpirationDuration = 7200

export const redisSeparator = {
  project: '/xFe'
}