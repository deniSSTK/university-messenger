import { MediaModule } from '../media/media.module.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../media/domain/object-storage.port.js';
import { AppConfigModule } from '../../core/config/config.module.js';
import { ChatEvents } from './service/chat-events.js';
import { ChatSocketServer } from './delivery/ws/chat-socket.server.js';
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
import { FfmpegVoiceAudio } from './repository/ffmpeg-voice-audio.js';
import type { VoiceAudio } from './domain/voice-audio.port.js';
import { ChatsService } from './service/chats.service.js';
import { ChatsController } from './delivery/http/chats.controller.js';
import { ChatMemberGuard } from './delivery/http/guards/chat-member.guard.js';

@Module({
  imports: [AuthModule, PrismaModule, AppConfigModule, MediaModule],
  controllers: [ChatsController],
  providers: [
    PrismaChatsRepository,
    ChatEvents,
    ChatSocketServer,
    FfmpegVoiceAudio,
    { provide: CHATS_REPOSITORY, useExisting: PrismaChatsRepository },
    { provide: MESSAGES_REPOSITORY, useExisting: PrismaChatsRepository },
    {
      provide: ChatsService,
      inject: [
        CHATS_REPOSITORY,
        MESSAGES_REPOSITORY,
        ChatEvents,
        OBJECT_STORAGE,
        FfmpegVoiceAudio,
      ],
      useFactory: (
        chats: IChatsRepository,
        messages: IMessagesRepository,
        events: ChatEvents,
        storage: ObjectStorage,
        voiceAudio: VoiceAudio,
      ) => new ChatsService(chats, messages, events, storage, voiceAudio),
    },
    ChatMemberGuard,
  ],
})
class ChatsModule {}

export { ChatsModule };
