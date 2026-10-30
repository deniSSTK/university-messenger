import { NestFactory } from '@nestjs/core';
import { AppConfig } from './core/config/app.config.js';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get(AppConfig);

  await app.listen(config.port);
}

void bootstrap();
