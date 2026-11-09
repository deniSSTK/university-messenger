import { APP_FILTER } from '@nestjs/core';
import { MediaExceptionFilter } from './modules/media/delivery/http/media-exception.filter.js';
import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ChatsModule } from './modules/chats/chats.module.js';

@Module({
  providers: [{ provide: APP_FILTER, useClass: MediaExceptionFilter }],
  imports: [AuthModule, UsersModule, ChatsModule],
})
class AppModule {}

export { AppModule };
