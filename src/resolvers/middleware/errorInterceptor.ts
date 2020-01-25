import { MiddlewareFn } from 'type-graphql';

export const ErrorInterceptor: MiddlewareFn<any> = async (_, next) => {
  try {
    return await next();
  } catch (err) {
    // write error to file log
    console.log(err);

    // rethrow the error
    throw err;
  }
};
