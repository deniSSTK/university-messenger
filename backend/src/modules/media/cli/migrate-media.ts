import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { readDatabaseConfig } from '../../../core/config/environment.js';
import { readStorageConfig } from '../../../core/config/storage.config.js';
import { PrismaLegacyMediaRepository } from '../repository/prisma-legacy-media.repository.js';
import { S3ObjectStorage } from '../repository/s3-object-storage.js';
import { MediaMigration } from '../service/migrate-media.js';
async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(readDatabaseConfig()),
  });
  const storage = new S3ObjectStorage(readStorageConfig());

  try {
    const result = await new MediaMigration(
      new PrismaLegacyMediaRepository(prisma),
      storage,
    ).run();
    console.log(
      `Migrated attachments: ${result.attachments}; avatars: ${result.avatars}`,
    );
  } finally {
    await prisma.$disconnect();
    storage.onModuleDestroy();
  }
}

void main().catch(() => {
  console.error(
    'Media migration failed. Database payloads not yet migrated remain available. Check storage configuration and rerun.',
  );
  process.exitCode = 1;
});
