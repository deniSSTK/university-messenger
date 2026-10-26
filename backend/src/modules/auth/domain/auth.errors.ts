class DuplicateUserError extends Error {
  constructor() {
    super('Email or username already in use');
  }
}

class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
  }
}

class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid refresh token');
  }
}

class InvalidSessionError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

export {
  DuplicateUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidSessionError,
};
