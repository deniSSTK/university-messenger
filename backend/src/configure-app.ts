import { json } from 'express';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppConfig } from './core/config/app.config.js';
import { configureSwagger } from './configure-swagger.js';

function configureApp(app: INestApplication) {
  const config = app.get(AppConfig);
  app.use(json({ limit: '8mb' }));
  app.use(cookieParser());
  app.enableCors({ origin: config.frontendOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.enableShutdownHooks();
  configureSwagger(app);
}

export { configureApp };
