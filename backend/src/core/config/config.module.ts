import { Module } from '@nestjs/common';
import { AppConfig } from './app.config.js';

@Module({ providers: [AppConfig], exports: [AppConfig] })
class AppConfigModule {}

export { AppConfigModule };
