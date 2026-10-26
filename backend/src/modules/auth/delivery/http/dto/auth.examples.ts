const AUTH_EXAMPLES = {
  email: 'alice@example.com',
  password: 'Example-password123',
  username: 'alice',
  displayName: 'Alice',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  createdAt: '2026-10-26T10:00:00.000Z',
  updatedAt: '2026-10-26T10:00:00.000Z',
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.example.signature',
  tokenType: 'Bearer',
  expiresIn: 900,
} as const;

const AUTH_USER_EXAMPLE = {
  id: AUTH_EXAMPLES.userId,
  email: AUTH_EXAMPLES.email,
  username: AUTH_EXAMPLES.username,
  displayName: AUTH_EXAMPLES.displayName,
  createdAt: AUTH_EXAMPLES.createdAt,
  updatedAt: AUTH_EXAMPLES.updatedAt,
} as const;

export { AUTH_EXAMPLES, AUTH_USER_EXAMPLE };
