import { Module } from '@nestjs/common';
import { AppConfigModule } from '../core/config/config.module.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [AppConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
class PrismaModule {}

export { PrismaModule };
