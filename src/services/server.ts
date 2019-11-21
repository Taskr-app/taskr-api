import { ApolloServer } from 'apollo-server-express';
import { buildSchemaSync } from 'type-graphql';
import { pubSub } from './redis';

import resolvers from '../resolvers';

export const server = new ApolloServer({
  schema: buildSchemaSync({
    resolvers,
    pubSub,
    validate: false
  }),
  context: ({ req, res }) => ({ req, res })
});
