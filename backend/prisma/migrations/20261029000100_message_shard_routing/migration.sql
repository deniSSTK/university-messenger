ALTER TABLE "Chat" ADD COLUMN "messageShardId" TEXT;
CREATE INDEX "User_active_username_prefix_idx"
ON "User" (LOWER("username") text_pattern_ops)
WHERE "deletedAt" IS NULL;
