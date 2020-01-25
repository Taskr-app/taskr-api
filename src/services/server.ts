import { ApolloServer } from 'apollo-server-express';
import { buildSchemaSync } from 'type-graphql';
import { pubSub } from './redis';

import resolvers from '../resolvers';
import { ErrorInterceptor } from '../resolvers/middleware/errorInterceptor';

export const server = new ApolloServer({
  schema: buildSchemaSync({
    resolvers,
    pubSub,
    validate: false,
    globalMiddlewares: [ErrorInterceptor]
  }),
  context: ({ req, res }) => ({ req, res })
});
