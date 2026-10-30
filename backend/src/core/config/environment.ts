import 'dotenv/config';

type DatabaseConfig = {
  user: string;
  password: string;
  database: string;
  host: string;
  port: number;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statement_timeout: number;
  idle_in_transaction_session_timeout: number;
  transactionTimeoutMs: number;
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

function readBoundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);

  if (
    (!raw?.trim() && raw !== undefined) ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
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
    max: readBoundedInteger('DB_POOL_MAX', 10, 1, 100),
    connectionTimeoutMillis: readBoundedInteger(
      'DB_CONNECT_TIMEOUT_MS',
      5000,
      100,
      60000,
    ),
    idleTimeoutMillis: readBoundedInteger(
      'DB_IDLE_TIMEOUT_MS',
      30000,
      1000,
      600000,
    ),
    statement_timeout: readBoundedInteger(
      'DB_STATEMENT_TIMEOUT_MS',
      10000,
      100,
      300000,
    ),
    idle_in_transaction_session_timeout: readBoundedInteger(
      'DB_TRANSACTION_TIMEOUT_MS',
      15000,
      1000,
      300000,
    ),
    transactionTimeoutMs: readBoundedInteger(
      'DB_TRANSACTION_TIMEOUT_MS',
      15000,
      1000,
      300000,
    ),
  };
}

export {
  readDatabaseConfig,
  readPort,
  readPositiveInteger,
  readBoundedInteger,
};
export type { DatabaseConfig };
