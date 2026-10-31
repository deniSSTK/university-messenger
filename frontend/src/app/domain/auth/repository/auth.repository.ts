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

interface AuthRepository {
  login(input: LoginRepositoryInput): Promise<AuthRepositoryResult>;
  register(input: RegisterRepositoryInput): Promise<AuthRepositoryResult>;
}

const AUTH_REPOSITORY = new InjectionToken<AuthRepository>('AUTH_REPOSITORY');

export { AUTH_REPOSITORY };
export type { AuthRepository, AuthRepositoryResult, LoginRepositoryInput, RegisterRepositoryInput };
