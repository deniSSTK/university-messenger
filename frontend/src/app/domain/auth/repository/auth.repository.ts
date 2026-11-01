import { InjectionToken } from '@angular/core';

interface LoginRepositoryInput {
  email: string;
  password: string;
}

interface RegisterRepositoryInput extends LoginRepositoryInput {
  username: string;
  displayName: string;
}

interface AuthRepositoryResult {
  accessToken: string;
}

type AuthRepositoryErrorCode =
  'credentials' | 'conflict' | 'validation' | 'unavailable' | 'forbidden' | 'unknown';

class AuthRepositoryError extends Error {
  constructor(readonly code: AuthRepositoryErrorCode) {
    super(code);
  }
}

interface AuthRepository {
  login(input: LoginRepositoryInput): Promise<AuthRepositoryResult>;
  register(input: RegisterRepositoryInput): Promise<AuthRepositoryResult>;
  restore(): Promise<AuthRepositoryResult>;
  logout(): Promise<void>;
}

const AUTH_REPOSITORY = new InjectionToken<AuthRepository>('AUTH_REPOSITORY');

export { AUTH_REPOSITORY, AuthRepositoryError };
export type { AuthRepository, AuthRepositoryResult, LoginRepositoryInput, RegisterRepositoryInput };
