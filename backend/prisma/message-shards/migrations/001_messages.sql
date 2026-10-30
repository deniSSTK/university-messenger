CREATE TABLE IF NOT EXISTS "MessageStorageMigration" (
  "name" TEXT PRIMARY KEY,
  "checksum" TEXT NOT NULL,
  "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "StoredMessage" (
  "id" UUID NOT NULL,
  "chatId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "editedAt" TIMESTAMPTZ(3),
  "readAt" TIMESTAMPTZ(3),
  "deletedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

CREATE INDEX IF NOT EXISTS "StoredMessage_chatId_createdAt_id_idx"
ON "StoredMessage" ("chatId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "StoredMessage_senderId_idx" ON "StoredMessage" ("senderId");
CREATE TABLE IF NOT EXISTS "StoredMessage_default" PARTITION OF "StoredMessage" DEFAULT;

CREATE OR REPLACE FUNCTION ensure_message_partition(month_start DATE)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  range_start TIMESTAMPTZ;
  range_end TIMESTAMPTZ;
  partition_name TEXT;
BEGIN
  range_start := date_trunc('month', month_start::timestamp) AT TIME ZONE 'UTC';
  range_end := (date_trunc('month', month_start::timestamp) + INTERVAL '1 month') AT TIME ZONE 'UTC';
  partition_name := 'StoredMessage_' || to_char(month_start, 'YYYY_MM');
  LOCK TABLE "StoredMessage" IN ACCESS EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1 FROM pg_inherits
    WHERE inhparent = '"StoredMessage"'::regclass
      AND inhrelid = to_regclass(format('%I', partition_name))
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('CREATE TABLE %I (LIKE "StoredMessage" INCLUDING ALL)', partition_name);
  EXECUTE format(
    'WITH moved AS (DELETE FROM "StoredMessage_default" WHERE "createdAt" >= $1 AND "createdAt" < $2 RETURNING *) INSERT INTO %I SELECT * FROM moved',
    partition_name
  ) USING range_start, range_end;
  EXECUTE format(
    'ALTER TABLE "StoredMessage" ATTACH PARTITION %I FOR VALUES FROM (%L) TO (%L)',
    partition_name, range_start, range_end
  );
END;
$$;
