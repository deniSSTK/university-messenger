CREATE TYPE "ReactionType" AS ENUM ('HEART', 'CLOWN', 'THUMBS_UP', 'THUMBS_DOWN', 'FIRE', 'SMILING_FACE_WITH_HEARTS', 'CLAP');

ALTER TABLE "User" ADD COLUMN "defaultReaction" "ReactionType" NOT NULL DEFAULT 'HEART';
ALTER TABLE "Message" ADD COLUMN "reactionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MessageReaction" (
    "userId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("userId", "messageId"),
    CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
