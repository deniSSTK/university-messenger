import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import {
  CHATS_REPOSITORY,
  MESSAGES_REPOSITORY,
  type IChatsRepository,
  type IMessagesRepository,
} from './domain/chats.repository.js';
import { PrismaChatsRepository } from './repository/prisma-chats.repository.js';
import { ChatsService } from './service/chats.service.js';
import { ChatsController } from './delivery/http/chats.controller.js';
import { ChatMemberGuard } from './delivery/http/guards/chat-member.guard.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ChatsController],
  providers: [
    PrismaChatsRepository,
    { provide: CHATS_REPOSITORY, useExisting: PrismaChatsRepository },
    { provide: MESSAGES_REPOSITORY, useExisting: PrismaChatsRepository },
    {
      provide: ChatsService,
      inject: [CHATS_REPOSITORY, MESSAGES_REPOSITORY],
      useFactory: (chats: IChatsRepository, messages: IMessagesRepository) =>
        new ChatsService(chats, messages),
    },
    ChatMemberGuard,
  ],
})
class ChatsModule {}

export { ChatsModule };
