import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import { PrismaClient as ShardClient } from '../../../generated/message-shards/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { DATABASE_CONFIG } from '../../../prisma/prisma.constants.js';
import type { DatabaseConfig } from '../../../core/config/environment.js';
import {
  MESSAGE_STORAGE_CONFIG,
  type MessageStorageConfig,
} from '../../../core/config/message-storage.config.js';
import { MessageShardUnavailableError } from '../domain/message-storage.errors.js';

@Injectable()
class MessageShardRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly clients = new Map<string, ShardClient>();

  constructor(
    @Inject(MESSAGE_STORAGE_CONFIG) readonly settings: MessageStorageConfig,
    @Inject(DATABASE_CONFIG) readonly database: DatabaseConfig,
    private readonly main: PrismaService,
  ) {
    for (const shard of settings.shards) {
      this.clients.set(
        shard.id,
        new ShardClient({
          adapter: new PrismaPg({
            connectionString: shard.url,
            max: Math.min(database.max, 10),
            connectionTimeoutMillis: database.connectionTimeoutMillis,
            idleTimeoutMillis: database.idleTimeoutMillis,
            statement_timeout: database.statement_timeout,
            idle_in_transaction_session_timeout:
              database.idle_in_transaction_session_timeout,
          }),
          transactionOptions: {
            timeout: database.transactionTimeoutMs,
            maxWait: database.connectionTimeoutMillis,
          },
        }),
      );
    }
  }

  async onModuleInit() {
    if (this.clients.size === 0) {
      return;
    }

    const query =
      'SELECT current_database() AS database, inet_server_addr()::text AS host, inet_server_port() AS port, extract(epoch FROM pg_postmaster_start_time())::text AS started';
    const identities = new Set([
      JSON.stringify(await this.main.$queryRawUnsafe<unknown[]>(query)),
    ]);

    try {
      for (const client of this.clients.values()) {
        await client.$connect();
        const identity = JSON.stringify(
          await client.$queryRawUnsafe<unknown[]>(query),
        );

        if (identities.has(identity)) {
          throw new Error(
            'Message shards must use separate databases from the primary and each other',
          );
        }

        identities.add(identity);
      }
    } catch (error) {
      await this.onModuleDestroy();

      throw error;
    }
  }

  async onModuleDestroy() {
    await Promise.all(
      [...this.clients.values()].map((client) => client.$disconnect()),
    );
  }

  get(shardId: string): ShardClient {
    const client = this.clients.get(shardId);

    if (!client) {
      throw new MessageShardUnavailableError();
    }

    return client;
  }

  select(chatId: string): string {
    const ids = [...this.clients.keys()];

    if (ids.length === 0) {
      throw new MessageShardUnavailableError();
    }

    return ids.sort((left, right) => {
      const leftScore = createHash('sha256')
        .update(`${chatId}:${left}`)
        .digest();
      const rightScore = createHash('sha256')
        .update(`${chatId}:${right}`)
        .digest();

      return Buffer.compare(rightScore, leftScore);
    })[0];
  }
}

export { MessageShardRegistry };
