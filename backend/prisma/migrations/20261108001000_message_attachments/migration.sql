ALTER TABLE "Message" ADD COLUMN "fileName" TEXT,
  ADD COLUMN "fileType" TEXT, ADD COLUMN "fileSize" INTEGER, ADD COLUMN "fileData" BYTEA;
ALTER TABLE "Message" ADD CONSTRAINT "Message_file_size_check" CHECK ("fileSize" IS NULL OR ("fileSize" BETWEEN 1 AND 5242880));
