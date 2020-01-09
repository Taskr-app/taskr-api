import 'dotenv/config';
import { Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchemaSync } from 'type-graphql';
import { sign } from 'jsonwebtoken';
import { Connection, createConnection } from 'typeorm';
import resolvers from '../../resolvers';

export const testServer = new ApolloServer({
  schema: buildSchemaSync({
    resolvers,
    validate: false
  }),
  context: () => {
    return {
      req: {
        headers: {
          authorization: `bearer ${sign(
            { userId: 1 },
            process.env.ACCESS_TOKEN_SECRET!,
            {
              expiresIn: '15m'
            }
          )}`
        }
      },
      res: {
        cookie: (_res: Response, payload: string) => payload
      }
    };
  },
  engine: false
});

export const createTestDbConnection = async () => {
  try {
    const connection = await createConnection();
    return connection
  } catch (err) {
    console.log(err);
    return err;
  }
};

export const closeTestDb = async (connection: Connection) => {
  try {
    await connection.close();
    return true;
  } catch (err) {
    console.log(err);
    return err;
  }
};
