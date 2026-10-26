import type { PublicUser } from '../domain/auth.models.js';

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = LoginInput & {
  username: string;
  displayName: string;
};

type AuthResult = {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  expiresAt: Date;
};

export type { LoginInput, RegisterInput, AuthResult };
