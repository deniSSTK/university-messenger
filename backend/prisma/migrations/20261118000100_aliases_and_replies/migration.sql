CREATE TYPE "NicknameColor" AS ENUM ('BLUE', 'PURPLE', 'GREEN', 'ORANGE', 'PINK', 'RED', 'CYAN');

CREATE TABLE "UserAlias" (
    "ownerId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "nickname" VARCHAR(64) NOT NULL,
    "color" "NicknameColor" NOT NULL,
    CONSTRAINT "UserAlias_pkey" PRIMARY KEY ("ownerId", "targetUserId"),
    CONSTRAINT "UserAlias_distinct_users" CHECK ("ownerId" <> "targetUserId"),
    CONSTRAINT "UserAlias_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAlias_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UserAlias_targetUserId_idx" ON "UserAlias"("targetUserId");

ALTER TABLE "Message" ADD COLUMN "replyToId" UUID;
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
