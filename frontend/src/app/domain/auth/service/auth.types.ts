interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  username: string;
  displayName: string;
}

interface AuthResult {
  accessToken: string;
}

type AuthErrorCode = 'credentials' | 'conflict' | 'validation' | 'unavailable' | 'forbidden' | 'unknown';

export type { AuthErrorCode, AuthResult, LoginInput, RegisterInput };
