import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/http/session.service';
import { AUTH_REPOSITORY, AuthRepositoryError } from '../repository/auth.repository';
import type { AuthErrorCode, AuthResult, LoginInput, RegisterInput } from './auth.types';

class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}

@Injectable({ providedIn: 'root' })
class Auth {
  private repository = inject(AUTH_REPOSITORY);
  private session = inject(SessionService);
  private restorationCompleted = false;
  private restoration: Promise<boolean> | null = null;

  async register(input: RegisterInput): Promise<AuthResult> {
    try {
      const result = await this.repository.register({
        email: input.email.trim(),
        password: input.password,
        username: input.username.trim().toLowerCase(),
        displayName: input.displayName.trim(),
      });
      this.session.setAccessToken(result.accessToken);

      return { accessToken: result.accessToken };
    } catch (error: unknown) {
      throw this.toAuthError(error);
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    try {
      const result = await this.repository.login({
        email: input.email.trim(),
        password: input.password,
      });
      this.session.setAccessToken(result.accessToken);

      return { accessToken: result.accessToken };
    } catch (error: unknown) {
      throw this.toAuthError(error);
    }
  }

  restoreSession(): Promise<boolean> {
    if (this.session.getAccessToken()) {
      return Promise.resolve(true);
    }

    if (this.restorationCompleted) {
      return Promise.resolve(false);
    }

    if (!this.restoration) {
      this.restoration = this.repository
        .restore()
        .then(() => {
          this.restorationCompleted = true;
          return true;
        })
        .catch((error: unknown) => {
          this.restorationCompleted =
            error instanceof AuthRepositoryError && error.code === 'credentials';
          return false;
        })
        .finally(() => {
          this.restoration = null;
        });
    }

    return this.restoration;
  }

  async logout(): Promise<void> {
    try {
      await this.repository.logout();
      this.session.clear();
    } catch (error: unknown) {
      if (error instanceof AuthRepositoryError && error.code === 'credentials') {
        this.session.clear();
        return;
      }

      throw this.toAuthError(error);
    }
  }

  private toAuthError(error: unknown): AuthError {
    return new AuthError(error instanceof AuthRepositoryError ? error.code : 'unknown');
  }
}

export { Auth, AuthError };
