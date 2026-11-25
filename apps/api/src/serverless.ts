import 'reflect-metadata';
import express, { type Express } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

/**
 * Entry for serverless hosts (Vercel Functions). Builds the same Nest app as main.ts, but
 * hands the Express instance to the platform instead of listening on a port. The app is
 * created once per instance and reused by every request that instance serves.
 */
let ready: Promise<Express> | undefined;

export function getServer(): Promise<Express> {
  ready ??= (async () => {
    const server = express();
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(server),
      {
        bufferLogs: true,
        bodyParser: false,
      },
    );
    app.useLogger(app.get(Logger));
    configureApp(app);
    await app.init();
    return server;
  })().catch((err) => {
    ready = undefined; // let the next request try again instead of caching the failure
    throw err;
  });
  return ready;
}
