import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { MessageShardRegistry } from './message-shard.registry.js';

type ShardMigration = {
  name: string;
  sql: string;
  checksum: string;
};

@Injectable()
class MessageStorageMaintenanceRepository {
  constructor(private readonly shards: MessageShardRegistry) {}

  async migrate() {
    const directory = join(process.cwd(), 'prisma/message-shards/migrations');
    const entries = await readdir(directory, { withFileTypes: true });
    const migrations: ShardMigration[] = [];

    for (const entry of entries
      .filter(
        (item) => item.isFile() && /^\d+_[a-z0-9_]+\.sql$/.test(item.name),
      )
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const sql = await readFile(join(directory, entry.name), 'utf8');
      const checksum = createHash('sha256')
        .update(sql.replace(/\r\n/g, '\n'))
        .digest('hex');
      migrations.push({ name: entry.name.slice(0, -4), sql, checksum });
    }

    for (const shard of this.shards.settings.shards) {
      const pool = new Pool({
        connectionString: shard.url,
        max: 1,
        connectionTimeoutMillis: this.shards.database.connectionTimeoutMillis,
        statement_timeout: this.shards.settings.migrationTimeoutMs,
      });
      const connection = await pool.connect().catch(async (error: unknown) => {
        await pool.end();

        throw error;
      });

      try {
        await connection.query('BEGIN');
        await connection.query('SELECT pg_advisory_xact_lock(297619384501)');
        await connection.query(
          'CREATE TABLE IF NOT EXISTS "MessageStorageMigration" ("name" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now())',
        );
        for (const migration of migrations) {
          const previous = await connection.query<{ checksum: string }>(
            'SELECT "checksum" FROM "MessageStorageMigration" WHERE "name" = $1',
            [migration.name],
          );

          if (
            previous.rows[0] &&
            previous.rows[0].checksum !== migration.checksum
          ) {
            throw new Error('An applied message shard migration was modified');
          }

          if (!previous.rows[0]) {
            await connection.query(migration.sql);
            await connection.query(
              'INSERT INTO "MessageStorageMigration" ("name", "checksum") VALUES ($1, $2)',
              [migration.name, migration.checksum],
            );
          }
        }

        await connection.query('COMMIT');
      } catch (error) {
        await connection.query('ROLLBACK');

        throw error;
      } finally {
        connection.release();
        await pool.end();
      }
    }

    return this.partitions();
  }

  async partitions() {
    const completed: { shardId: string; months: string[] }[] = [];
    const now = new Date();

    for (const shard of this.shards.settings.shards) {
      const client = this.shards.get(shard.id);
      const months: string[] = [];

      for (
        let offset = -1;
        offset <= this.shards.settings.partitionMonthsAhead;
        offset++
      ) {
        const month = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
        )
          .toISOString()
          .slice(0, 10);
        await client.$queryRaw`SELECT ensure_message_partition(${month}::date)::text`;
        months.push(month);
      }

      completed.push({ shardId: shard.id, months });
    }

    return completed;
  }

  async status() {
    const result: {
      shardId: string;
      migrated: boolean;
      messages?: string;
      partitions?: string[];
    }[] = [];

    for (const shard of this.shards.settings.shards) {
      const client = this.shards.get(shard.id);
      const ready = await client.$queryRaw<
        { ready: boolean }[]
      >`SELECT to_regclass('public."StoredMessage"') IS NOT NULL AS ready`;

      if (!ready[0].ready) {
        result.push({ shardId: shard.id, migrated: false });
        continue;
      }

      const messages = await client.storedMessage.count();
      const partitions = await client.$queryRaw<{ name: string }[]>`
        SELECT child.relname AS name FROM pg_inherits
        JOIN pg_class child ON child.oid = inhrelid
        WHERE inhparent = '"StoredMessage"'::regclass ORDER BY child.relname
      `;
      result.push({
        shardId: shard.id,
        migrated: true,
        messages: String(messages),
        partitions: partitions.map((partition) => partition.name),
      });
    }

    return result;
  }
}

export { MessageStorageMaintenanceRepository };
