ALTER TABLE "User" ADD COLUMN "avatarKey" TEXT;
ALTER TABLE "Message" ADD COLUMN "fileKey" TEXT;
-- Legacy payload columns remain until npm run media:migrate has moved existing content.
