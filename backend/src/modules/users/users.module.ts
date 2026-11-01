import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from './domain/users.repository.js';
import { PrismaUsersRepository } from './repository/prisma-users.repository.js';
import { UsersService } from './service/users.service.js';
import { UsersController } from './delivery/http/users.controller.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [UsersController],
  providers: [
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    {
      provide: UsersService,
      inject: [USERS_REPOSITORY],
      useFactory: (repository: UsersRepository) => new UsersService(repository),
    },
  ],
})
class UsersModule {}

export { UsersModule };
