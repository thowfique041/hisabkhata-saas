import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { AppConfig } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(Logger));
  configureApp(app);
  app.enableShutdownHooks();
  const port = app.get(AppConfig).get('PORT');
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`HisabKhata API listening on :${port} (docs at /api/docs)`);
}

void bootstrap();
