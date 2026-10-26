import 'dotenv/config';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const { DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
      throw new Error('DB_USER, DB_PASSWORD and DB_NAME are required');
    }
    super({
      adapter: new PrismaPg({
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
