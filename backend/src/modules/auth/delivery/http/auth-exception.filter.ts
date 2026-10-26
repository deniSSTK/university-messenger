import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DuplicateUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidSessionError,
} from '../../domain/auth.errors.js';

type AuthError =
  | DuplicateUserError
  | InvalidCredentialsError
  | InvalidRefreshTokenError
  | InvalidSessionError;

@Catch(
  DuplicateUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidSessionError,
)
class AuthExceptionFilter implements ExceptionFilter<AuthError> {
  catch(error: AuthError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const isConflict = error instanceof DuplicateUserError;
    const statusCode = isConflict ? 409 : 401;

    response.status(statusCode).json({
      statusCode,
      message: error.message,
      error: isConflict ? 'Conflict' : 'Unauthorized',
    });
  }
}

export { AuthExceptionFilter };
