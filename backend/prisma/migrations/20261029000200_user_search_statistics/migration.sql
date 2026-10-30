CREATE STATISTICS "User_username_search_stats" ON (LOWER("username")) FROM "User";
ANALYZE "User";
