-- Preserve the original email while enforcing case-insensitive uniqueness.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email"));
