interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash?: string): Promise<boolean>;
}

interface AccessTokenIssuer {
  issue(userId: string, sessionId: string): Promise<string>;
}

type AuthSettings = {
  accessTokenTtl: number;
  sessionTtl: number;
};

export type { PasswordHasher, AccessTokenIssuer, AuthSettings };
