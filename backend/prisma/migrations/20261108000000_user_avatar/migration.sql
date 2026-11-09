ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
CREATE INDEX "Message_unread_idx" ON "Message" ("chatId", "senderId") WHERE "readAt" IS NULL AND "deletedAt" IS NULL;
