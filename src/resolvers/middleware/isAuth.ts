import { MiddlewareFn } from 'type-graphql';
import { MyContext } from '../../services/context';
import { verify } from 'jsonwebtoken';
import { verifyIdToken } from './../../services/auth/google';
import { User } from '../../entity/User';
import { AuthenticationError } from 'apollo-server-express';

export const isAuth: MiddlewareFn<MyContext> = async ({ context }, next) => {
  const authorization = context.req.headers['authorization'];
  if (!authorization) {
    throw new AuthenticationError('Not authenticated');
  }

  try {
    const token = authorization.split(' ')[1];
    let payload = verify(token, process.env.ACCESS_TOKEN_SECRET!) as any;
    const { googleIdToken } = payload;

    // payload contains googleIdToken instead of user
    if (googleIdToken) {
      const googleTokenPayload = await verifyIdToken(googleIdToken);
      if (googleTokenPayload) {
        const user = await User.findOne({ email: googleTokenPayload.email });
        if (!user) {
          throw new Error('User not found');
        }
        payload = { userId: user.id };
      }
    }
    context.payload = payload as any;
  } catch (err) {
    console.log(err);
    return err;
  }
  return next();
};
