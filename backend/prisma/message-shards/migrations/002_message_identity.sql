LOCK TABLE "StoredMessage" IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE "StoredMessageIdentity" (
  "id" UUID PRIMARY KEY,
  "chatId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL
);

INSERT INTO "StoredMessageIdentity" ("id", "chatId", "createdAt")
SELECT "id", "chatId", "createdAt" FROM "StoredMessage";

CREATE FUNCTION reserve_message_identity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "StoredMessageIdentity" ("id", "chatId", "createdAt")
  VALUES (NEW."id", NEW."chatId", NEW."createdAt")
  ON CONFLICT ("id") DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM "StoredMessageIdentity"
    WHERE "id" = NEW."id" AND "chatId" = NEW."chatId" AND "createdAt" = NEW."createdAt"
  ) THEN
    RAISE EXCEPTION 'Message identity conflict' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER stored_message_identity
BEFORE INSERT OR UPDATE OF "id", "chatId", "createdAt" ON "StoredMessage"
FOR EACH ROW EXECUTE FUNCTION reserve_message_identity();
