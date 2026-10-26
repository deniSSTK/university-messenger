import { defineConfig } from 'prisma/config';
import { readDatabaseConfig } from './src/core/config/environment.js';

const { user, password, host, port, database } = readDatabaseConfig();
const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=public`;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
