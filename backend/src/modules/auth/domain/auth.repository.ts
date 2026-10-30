import type {
  PublicUser,
  AuthUser,
  Session,
  RefreshSession,
  ActiveSession,
} from './auth.models.js';

type CreateUserInput = {
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
};

type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

type RotateRefreshTokenInput = {
  sessionId: string;
  previousHash: string;
  nextHash: string;
  now: Date;
};

interface AuthRepositoryOperations {
  createUser(input: CreateUserInput): Promise<PublicUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findActiveUser(userId: string): Promise<PublicUser | null>;
  createSession(input: CreateSessionInput): Promise<Session>;
  findRefreshSession(
    tokenHash: string,
    now: Date,
  ): Promise<RefreshSession | null>;
  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<boolean>;
  findActiveSession(
    sessionId: string,
    userId: string,
  ): Promise<ActiveSession | null>;
  revokeSession(sessionId: string, userId: string): Promise<void>;
}

interface AuthRepository extends AuthRepositoryOperations {
  transaction<T>(
    operation: (repository: AuthRepositoryOperations) => Promise<T>,
  ): Promise<T>;
}

const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export { AUTH_REPOSITORY };
export type {
  AuthRepository,
  AuthRepositoryOperations,
  CreateUserInput,
  CreateSessionInput,
  RotateRefreshTokenInput,
};
