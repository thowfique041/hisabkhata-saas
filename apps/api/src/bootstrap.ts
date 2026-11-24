import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppConfig } from './config/app-config.service';

/** Shared HTTP setup for main.ts and the e2e test harness. */
export function configureApp(app: INestApplication) {
  const config = app.get(AppConfig);
  const express = app as NestExpressApplication;
  express.set('trust proxy', config.get('TRUST_PROXY_HOPS'));
  express.disable('x-powered-by');

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Swagger UI needs inline styles/scripts on /api/docs only.
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || config.corsOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization', 'X-Request-Id'],
    maxAge: 600,
  });
  express.useBodyParser('json', { limit: '1mb' });
  express.useBodyParser('urlencoded', { extended: false, limit: '256kb' });

  const doc = new DocumentBuilder()
    .setTitle('HisabKhata API')
    .setDescription(
      'Multi-tenant inventory, POS and invoicing API. Authenticate with POST /api/auth/token and use the Bearer token, ' +
        'or sign in through the web app (cookie session). Tenant-scoped endpoints act on the business selected in your session.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('hk_at')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc), {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'HisabKhata API',
  });
  return app;
}
