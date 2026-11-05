BEGIN;

ALTER TABLE "Chat"
    ADD COLUMN "privateUserAId" UUID,
    ADD COLUMN "privateUserBId" UUID;

WITH "pairs" AS (
    SELECT "chatId", array_agg("userId" ORDER BY "userId") AS "userIds"
    FROM "ChatMember"
    GROUP BY "chatId"
    HAVING count(*) = 2
)
UPDATE "Chat" AS "chat"
SET "privateUserAId" = "pairs"."userIds"[1],
    "privateUserBId" = "pairs"."userIds"[2]
FROM "pairs"
WHERE "chat"."id" = "pairs"."chatId";

ALTER TABLE "Chat"
    ALTER COLUMN "privateUserAId" SET NOT NULL,
    ALTER COLUMN "privateUserBId" SET NOT NULL,
    ADD CONSTRAINT "Chat_private_pair_order_check"
        CHECK ("privateUserAId" < "privateUserBId");

CREATE UNIQUE INDEX "Chat_active_private_pair_key"
    ON "Chat" ("privateUserAId", "privateUserBId")
    WHERE "deletedAt" IS NULL;

COMMIT;
