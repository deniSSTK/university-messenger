import { readDatabaseConfig } from '../core/config/environment.js';
import { readMessageStorageConfig } from '../core/config/message-storage.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessageShardRegistry } from '../modules/message-storage/repository/message-shard.registry.js';
import { MessageStorageMaintenanceRepository } from '../modules/message-storage/repository/message-storage-maintenance.repository.js';
import { PrismaMessageStorageRepository } from '../modules/message-storage/repository/prisma-message-storage.repository.js';
import { MessageStorageService } from '../modules/message-storage/service/message-storage.service.js';

async function run() {
  const settings = readMessageStorageConfig();
  const database = readDatabaseConfig();
  const primary = new PrismaService(database);
  const shards = new MessageShardRegistry(settings, database, primary);

  try {
    await primary.onModuleInit();
    await shards.onModuleInit();
    const maintenance = new MessageStorageMaintenanceRepository(shards);
    const command = process.argv[2];
    let result: unknown;

    if (command === 'migrate') {
      result = await maintenance.migrate();
    } else if (command === 'partitions') {
      result = await maintenance.partitions();
    } else if (command === 'status') {
      result = await maintenance.status();
    } else if (command === 'move-chat') {
      const service = new MessageStorageService(
        new PrismaMessageStorageRepository(primary, shards),
      );

      if (!process.argv[3]) {
        throw new Error(
          'Usage: npm run storage:move-chat -- <chatId> [shardId]',
        );
      }

      result = await service.moveChat(process.argv[3], process.argv[4]);
    } else {
      throw new Error('Unknown message storage command');
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await shards.onModuleDestroy();
    await primary.onModuleDestroy();
  }
}

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Message storage command failed',
  );
  process.exitCode = 1;
});
