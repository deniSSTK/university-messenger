import 'dotenv/config';

type DatabaseConfig = {
  user: string;
  password: string;
  database: string;
  host: string;
  port: number;
};

function readRequiredString(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function readPort(name: string, defaultValue: number) {
  const value = process.env[name];
  const port = value === undefined ? defaultValue : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return port;
}

function readPositiveInteger(name: string) {
  const value = Number(readRequiredString(name));

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }

  return value;
}

function readDatabaseConfig(): DatabaseConfig {
  return {
    user: readRequiredString('DB_USER'),
    password: readRequiredString('DB_PASSWORD'),
    database: readRequiredString('DB_NAME'),
    host: process.env.DB_HOST ?? 'localhost',
    port: readPort('DB_PORT', 5432),
  };
}

export { readDatabaseConfig, readPort, readPositiveInteger };
export type { DatabaseConfig };
