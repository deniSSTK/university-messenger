import {
  Injectable,
  Inject,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { DatabaseConfig } from '../core/config/environment.js';
import { DATABASE_CONFIG } from './prisma.constants.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Inject(DATABASE_CONFIG) database: DatabaseConfig) {
    const { transactionTimeoutMs, ...connection } = database;
    super({
      adapter: new PrismaPg(connection),
      transactionOptions: {
        timeout: transactionTimeoutMs,
        maxWait: connection.connectionTimeoutMillis,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export { PrismaService };
