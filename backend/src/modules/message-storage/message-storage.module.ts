import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../core/config/config.module.js';
import { AppConfig } from '../../core/config/app.config.js';
import { MESSAGE_STORAGE_CONFIG } from '../../core/config/message-storage.config.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { DATABASE_CONFIG } from '../../prisma/prisma.constants.js';
import {
  MESSAGE_STORAGE_REPOSITORY,
  type MessageStorageRepository,
} from './domain/message-storage.repository.js';
import { MessageShardRegistry } from './repository/message-shard.registry.js';
import { PrismaMessageStorageRepository } from './repository/prisma-message-storage.repository.js';
import { MessageStorageService } from './service/message-storage.service.js';

@Module({
  imports: [PrismaModule, AppConfigModule],
  providers: [
    {
      provide: MESSAGE_STORAGE_CONFIG,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => config.messageStorage,
    },
    {
      provide: DATABASE_CONFIG,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => config.database,
    },
    MessageShardRegistry,
    {
      provide: MESSAGE_STORAGE_REPOSITORY,
      useClass: PrismaMessageStorageRepository,
    },
    {
      provide: MessageStorageService,
      inject: [MESSAGE_STORAGE_REPOSITORY],
      useFactory: (repository: MessageStorageRepository) =>
        new MessageStorageService(repository),
    },
  ],
  exports: [MessageStorageService],
})
class MessageStorageModule {}

export { MessageStorageModule };
