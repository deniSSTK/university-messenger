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

export type { AuthResult, LoginInput, RegisterInput };
