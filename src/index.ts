import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { createConnection } from 'typeorm';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { refreshAccessToken } from './services/auth/refreshAccessToken';
import { server } from './services/server';
import { createServer } from 'http';
import chokidar from 'chokidar';
import { eventColors } from './services/eventColors';

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  const app = express();
  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true
    })
  );

  chokidar
    .watch('./', {
      ignored: /(^|[\/\\])\../,
      ignoreInitial: true
    })
    .on('all', (event, path) => {
      console.log(eventColors(event), `${event} - ${path}`)
    })

  app.get('/', (_req, res) => res.send('taskr-api'));
  app.post('/refresh_token', cookieParser(), refreshAccessToken);
  server.applyMiddleware({ app, cors: false });
  const ws = createServer(app);
  server.installSubscriptionHandlers(ws);
  await createConnection();

  ws.listen(PORT, () =>
    console.log('\x1b[34m%s\x1b[0m', `Express server listening on ${PORT}`)
  );
};

startServer();
