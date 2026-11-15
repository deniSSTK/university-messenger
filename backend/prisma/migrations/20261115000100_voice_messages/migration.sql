ALTER TABLE "Message"
    ADD COLUMN "voiceRequestId" UUID,
    ADD COLUMN "voiceDurationMs" INTEGER,
    ADD COLUMN "voiceWaveform" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE UNIQUE INDEX "Message_chatId_senderId_voiceRequestId_key"
    ON "Message" ("chatId", "senderId", "voiceRequestId");
