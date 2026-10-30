import { Module } from '@nestjs/common';
import { AppConfigModule } from '../core/config/config.module.js';
import { PrismaService } from './prisma.service.js';
import { AppConfig } from '../core/config/app.config.js';
import { DATABASE_CONFIG } from './prisma.constants.js';

@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: DATABASE_CONFIG,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => config.database,
    },
    PrismaService,
  ],
  exports: [PrismaService],
})
class PrismaModule {}

export { PrismaModule };
