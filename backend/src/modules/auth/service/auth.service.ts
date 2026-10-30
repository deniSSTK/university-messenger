import { createHash, randomBytes } from 'node:crypto';
import type {
  AuthRepository,
  AuthRepositoryOperations,
} from '../domain/auth.repository.js';
import type { PublicUser, AuthContext } from '../domain/auth.models.js';
import type {
  PasswordHasher,
  AccessTokenIssuer,
  AuthSettings,
} from '../domain/auth.ports.js';
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidSessionError,
} from '../domain/auth.errors.js';
import type { LoginInput, RegisterInput, AuthResult } from './auth.types.js';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokensIssuer: AccessTokenIssuer,
    private readonly config: AuthSettings,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);

    return this.repository.transaction(async (repository) => {
      const user = await repository.createUser({
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash,
      });

      return this.createSession(repository, user);
    });
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(input.email);
    const valid = await this.passwords.verify(
      input.password,
      user?.passwordHash,
    );

    if (!user || !valid || user.deletedAt) {
      throw new InvalidCredentialsError();
    }

    // Recheck deletion in the transaction that creates the session.
    return this.repository.transaction(async (repository) => {
      const activeUser = await repository.findActiveUser(user.id);

      if (!activeUser) {
        throw new InvalidCredentialsError();
      }

      return this.createSession(repository, activeUser);
    });
  }

  async refresh(token: unknown): Promise<AuthResult> {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new InvalidRefreshTokenError();
    }

    const tokenHash = hashToken(token);
    const refreshToken = newToken();

    return this.repository.transaction(async (repository) => {
      const now = new Date();
      const session = await repository.findRefreshSession(tokenHash, now);

      if (!session) {
        throw new InvalidRefreshTokenError();
      }

      const rotated = await repository.rotateRefreshToken({
        sessionId: session.id,
        previousHash: tokenHash,
        nextHash: hashToken(refreshToken),
        now,
      });

      if (!rotated) {
        throw new InvalidRefreshTokenError();
      }

      return this.tokens(
        session.user,
        session.id,
        refreshToken,
        session.expiresAt,
      );
    });
  }

  async logout(sessionId: string, userId: string) {
    await this.repository.revokeSession(sessionId, userId);
  }

  async getActiveSession(
    sessionId: string,
    userId: string,
  ): Promise<AuthContext> {
    const session = await this.repository.findActiveSession(sessionId, userId);

    if (!session) {
      throw new InvalidSessionError();
    }

    return { user: session.user, sessionId: session.id };
  }

  private async createSession(
    repository: AuthRepositoryOperations,
    user: PublicUser,
  ) {
    const refreshToken = newToken();
    const session = await repository.createSession({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.config.sessionTtl),
    });

    return this.tokens(user, session.id, refreshToken, session.expiresAt);
  }

  private async tokens(
    user: PublicUser,
    sessionId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<AuthResult> {
    const accessToken = await this.tokensIssuer.issue(user.id, sessionId);

    return {
      user,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.accessTokenTtl,
      refreshToken,
      expiresAt,
    };
  }
}

export { AuthService };
