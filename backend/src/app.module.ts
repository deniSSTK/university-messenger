import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { MessageStorageModule } from './modules/message-storage/message-storage.module.js';

@Module({
  imports: [AuthModule, UsersModule, MessageStorageModule],
})
class AppModule {}

export { AppModule };
