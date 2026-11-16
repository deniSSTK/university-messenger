BEGIN;

LOCK TABLE "Message" IN ACCESS EXCLUSIVE MODE;

CREATE TYPE "AttachmentType" AS ENUM ('FILE', 'VOICE');

CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "fileData" BYTEA,
    "fileKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttachmentVoice" (
    "attachmentId" UUID NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "waveform" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    CONSTRAINT "AttachmentVoice_pkey" PRIMARY KEY ("attachmentId"),
    CONSTRAINT "AttachmentVoice_duration_check" CHECK ("durationMs" BETWEEN 1 AND 300000),
    CONSTRAINT "AttachmentVoice_waveform_check" CHECK (
        cardinality("waveform") <= 80
        AND array_position("waveform", NULL) IS NULL
        AND 0 <= ALL("waveform") AND 100 >= ALL("waveform")
    ),
    CONSTRAINT "AttachmentVoice_attachmentId_fkey"
        FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Message" ADD COLUMN "attachmentId" UUID;

INSERT INTO "Attachment" ("id", "type", "fileName", "fileType", "fileSize", "fileData", "fileKey", "createdAt")
SELECT "id",
       CASE WHEN "voiceDurationMs" IS NULL THEN 'FILE'::"AttachmentType" ELSE 'VOICE'::"AttachmentType" END,
       "fileName", "fileType", "fileSize", "fileData", "fileKey", "createdAt"
FROM "Message"
WHERE "fileName" IS NOT NULL OR "fileType" IS NOT NULL OR "fileSize" IS NOT NULL
   OR "fileData" IS NOT NULL OR "fileKey" IS NOT NULL OR "voiceDurationMs" IS NOT NULL;

INSERT INTO "AttachmentVoice" ("attachmentId", "durationMs", "waveform")
SELECT "id", "voiceDurationMs", "voiceWaveform"
FROM "Message"
WHERE "voiceDurationMs" IS NOT NULL;

UPDATE "Message" AS message
SET "attachmentId" = attachment."id"
FROM "Attachment" AS attachment
WHERE attachment."id" = message."id";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Message" AS message
        LEFT JOIN "Attachment" AS attachment ON attachment."id" = message."attachmentId"
        LEFT JOIN "AttachmentVoice" AS voice ON voice."attachmentId" = attachment."id"
        WHERE ROW(message."fileName", message."fileType", message."fileSize",
                  message."fileData", message."fileKey", message."voiceDurationMs", message."voiceWaveform")
              IS DISTINCT FROM
              ROW(attachment."fileName", attachment."fileType", attachment."fileSize",
                  attachment."fileData", attachment."fileKey", voice."durationMs",
                  COALESCE(voice."waveform", ARRAY[]::INTEGER[]))
           OR (attachment."id" IS NOT NULL AND (
               attachment."createdAt" <> message."createdAt"
               OR (attachment."type" = 'VOICE') <> (voice."attachmentId" IS NOT NULL)
           ))
    ) OR EXISTS (
        SELECT 1 FROM "Attachment" AS attachment
        WHERE NOT EXISTS (SELECT 1 FROM "Message" WHERE "attachmentId" = attachment."id")
    ) THEN
        RAISE EXCEPTION 'Attachment backfill verification failed';
    END IF;
END $$;

CREATE UNIQUE INDEX "Message_attachmentId_key" ON "Message"("attachmentId");
ALTER TABLE "Message"
    ADD CONSTRAINT "Message_attachmentId_fkey"
        FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    DROP COLUMN "fileName",
    DROP COLUMN "fileType",
    DROP COLUMN "fileSize",
    DROP COLUMN "fileData",
    DROP COLUMN "fileKey",
    DROP COLUMN "voiceDurationMs",
    DROP COLUMN "voiceWaveform";

COMMIT;
