import { gql } from 'apollo-server-express';
import {
  testServer,
  createTestDbConnection,
  closeTestDb
} from '../mocks/server';
import { User } from '../../entity/User';
import faker from 'faker';

import { createTestClient } from 'apollo-server-testing';
import { Connection } from 'typeorm';
import { redis } from '../../services/redis';
import { redisKeys } from '../../services/redis/keys';
const { query, mutate } = createTestClient(testServer);

describe('User Resolver', () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await createTestDbConnection();
  });

  afterAll(async () => {
    await closeTestDb(connection);
  });

  const mockUser = {
    email: faker.internet.email(),
    password: faker.internet.password(),
    newPassword: faker.internet.password(),
    newUsername: faker.internet.userName(),
    newEmail: faker.internet.email()
  };

  describe('SendVerificationLink and Register mutation', () => {
    it('should register a user into the db', async () => {
      const sendVerificationLink = await mutate({
        mutation: gql`
          mutation SendVerificationLink($email: String!, $password: String!) {
            sendVerificationLink(email: $email, password: $password)
          }
        `,
        variables: { email: mockUser.email, password: mockUser.password }
      });
      expect(sendVerificationLink.data).toBeDefined();
      expect(sendVerificationLink.errors).toBeUndefined();

      const register = await mutate({
        mutation: gql`
          mutation Register($email: String!, $verificationLink: String!) {
            register(email: $email, verificationLink: $verificationLink) {
              accessToken
            }
          }
        `,
        variables: {
          email: mockUser.email,
          verificationLink: sendVerificationLink.data!.sendVerificationLink
        }
      });

      const user = await User.findOne({ email: mockUser.email });

      expect(user!.email).toEqual(mockUser.email);
      expect(register.data).toBeDefined();
      expect(register.errors).toBeUndefined();
    });
  });

  describe('Login mutation', () => {
    it('should return an accessToken', async () => {
      const res = await mutate({
        mutation: gql`
          mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
              accessToken
            }
          }
        `,
        variables: { email: mockUser.email, password: mockUser.password }
      });
      expect(res.data).toBeDefined();
      expect(res.errors).toBeUndefined();
    });
  });

  describe('Me query', () => {
    it('should fetch a current user', async () => {
      const res = await query({
        query: gql`
          query Me {
            me {
              id
              email
            }
          }
        `
      });
      expect(res.data).toBeDefined();
      expect(res.errors).toBeUndefined();
    });
  });

  describe('Logout mutation', () => {
    it('should log the user out', async () => {
      const res = await mutate({
        mutation: gql`
          mutation Logout {
            logout
          }
        `
      });
      expect(res.data).toBeDefined();
      expect(res.errors).toBeUndefined();
    });
  });

  describe('ForgotPassword mutation', () => {
    it('should send a link to user\'s email and then update the user\'s password', async () => {
      jest.setTimeout(50000);
      const res = await mutate({
        mutation: gql`
          mutation SendForgotPasswordLink($email: String!) {
            sendForgotPasswordLink(email: $email)
          }
        `,
        variables: { email: mockUser.email }
      });
      expect(res.data).toBeDefined();
      expect(res.errors).toBeUndefined();

      const forgotPassword = await mutate({
        mutation: gql`
          mutation forgotPassword(
            $email: String!
            $forgotPasswordLink: String!
            $password: String!
          ) {
            forgotPassword(
              email: $email
              forgotPasswordLink: $forgotPasswordLink
              password: $password
            )
          }
        `,
        variables: {
          email: mockUser.email,
          forgotPasswordLink: res.data!.sendForgotPasswordLink,
          password: mockUser.newPassword
        }
      });
      expect(forgotPassword.data).toBeDefined();
      expect(forgotPassword.errors).toBeUndefined();
    });

    it('should fail login on old password and pass using new password', async () => {
      const incorrectLogin = await mutate({
        mutation: gql`
          mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
              accessToken
            }
          }
        `,
        variables: { email: mockUser.email, password: mockUser.password }
      });

      expect(incorrectLogin.errors).toBeDefined();

      const successfulLogin = await mutate({
        mutation: gql`
          mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
              accessToken
            }
          }
        `,
        variables: { email: mockUser.email, password: mockUser.newPassword }
      });

      expect(successfulLogin.data).toBeDefined();
      expect(successfulLogin.errors).toBeUndefined();
    });
  });

  describe('Change password mutation', () => {
    it('should change the user\'s password', async () => {
      const res = await mutate({
        mutation: gql`
          mutation ChangePassword(
            $currentPassword: String!
            $newPassword: String!
          ) {
            changePassword(
              currentPassword: $currentPassword
              newPassword: $newPassword
            )
          }
        `,
        variables: { currentPassword: 'password', newPassword: 'password2' }
      });

      const successfulLogin = await mutate({
        mutation: gql`
          mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
              accessToken
            }
          }
        `,
        variables: { email: 'dev@email.com', password: 'password2' }
      });

      expect(res.data).toBeDefined();
      expect(res.errors).toBeUndefined();
      expect(successfulLogin.data).toBeDefined();
      expect(successfulLogin.errors).toBeUndefined();
    });
  });

  describe('Update username mutation', () => {
    it('should change the user\'s username', async () => {
      const res = await mutate({
        mutation: gql`
          mutation UpdateUsername($username: String!) {
            updateUsername(username: $username)
          }
        `,
        variables: { username: mockUser.newUsername }
      });

      expect(res.data).toBeDefined();
      expect(res.errors).toBeUndefined();
    });
  });

  describe('SendNewEmailLink and updateEmail mutations', () => {
    it('should send a new-email link and update the user\'s email', async () => {
      const { data, errors } = await mutate({
        mutation: gql`
          mutation SendNewEmailLink($email: String!) {
            sendNewEmailLink(email: $email)
          }
        `,
        variables: { email: mockUser.newEmail }
      });

      expect(data).toBeDefined();
      expect(errors).toBeUndefined();

      const { link } = await redis.hgetall(
        redisKeys.newEmail(mockUser.newEmail)
      );
      expect(link).toBeDefined();

      const res = await mutate({
        mutation: gql`
          mutation UpdateEmail(
            $email: String!
            $verificationLink: String!
            $password: String
          ) {
            updateEmail(
              email: $email
              verificationLink: $verificationLink
              password: $password
            )
          }
        `,
        variables: {
          verificationLink: link,
          email: mockUser.newEmail
        }
      });

      expect(res.data).toBeDefined();
      expect(res.errors).toBeUndefined();
    });
  });
});
