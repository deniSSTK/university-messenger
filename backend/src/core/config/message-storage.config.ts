import { readBoundedInteger } from './environment.js';

type MessageShardConfig = { id: string; url: string };
type MessageStorageConfig = {
  shards: MessageShardConfig[];
  partitionMonthsAhead: number;
  migrationTimeoutMs: number;
};

const MESSAGE_STORAGE_CONFIG = Symbol('MESSAGE_STORAGE_CONFIG');

function isShardConfig(value: unknown): value is MessageShardConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    /^[a-z][a-z0-9_-]{0,31}$/.test(value.id) &&
    'url' in value &&
    typeof value.url === 'string'
  );
}

function readMessageStorageConfig(): MessageStorageConfig {
  const raw: unknown = JSON.parse(process.env.MESSAGE_SHARDS ?? '[]');

  if (!Array.isArray(raw) || raw.length > 16 || !raw.every(isShardConfig)) {
    throw new Error(
      'MESSAGE_SHARDS must be an array of up to 16 { id, url } entries',
    );
  }

  const ids = new Set<string>();
  const urls = new Set<string>();

  for (const shard of raw) {
    const url = new URL(shard.url);

    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2 ||
      ids.has(shard.id) ||
      urls.has(url.href)
    ) {
      throw new Error(
        'Message shard IDs and database URLs must be valid and unique',
      );
    }

    ids.add(shard.id);
    urls.add(url.href);
  }

  return {
    shards: raw,
    partitionMonthsAhead: readBoundedInteger(
      'MESSAGE_PARTITION_MONTHS_AHEAD',
      3,
      1,
      24,
    ),
    migrationTimeoutMs: readBoundedInteger(
      'MESSAGE_MIGRATION_TIMEOUT_MS',
      120000,
      1000,
      900000,
    ),
  };
}

export { MESSAGE_STORAGE_CONFIG, readMessageStorageConfig };
export type { MessageShardConfig, MessageStorageConfig };
