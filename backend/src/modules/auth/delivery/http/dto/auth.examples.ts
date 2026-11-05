import { UUID_EXAMPLE } from '../../../../../core/examples/uuid.examples.js';

const AUTH_EXAMPLES = {
  email: 'alice@example.com',
  password: 'Example-password123',
  username: 'alice',
  displayName: 'Alice',
  createdAt: '2026-10-26T10:00:00.000Z',
  updatedAt: '2026-10-26T10:00:00.000Z',
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.example.signature',
  tokenType: 'Bearer',
  expiresIn: 900,
} as const;

const AUTH_USER_EXAMPLE = {
  id: UUID_EXAMPLE,
  email: AUTH_EXAMPLES.email,
  username: AUTH_EXAMPLES.username,
  displayName: AUTH_EXAMPLES.displayName,
  createdAt: AUTH_EXAMPLES.createdAt,
  updatedAt: AUTH_EXAMPLES.updatedAt,
} as const;

export { AUTH_EXAMPLES, AUTH_USER_EXAMPLE };
