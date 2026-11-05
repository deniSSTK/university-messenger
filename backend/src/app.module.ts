import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ChatsModule } from './modules/chats/chats.module.js';

@Module({
  imports: [AuthModule, UsersModule, ChatsModule],
})
class AppModule {}

export { AppModule };
