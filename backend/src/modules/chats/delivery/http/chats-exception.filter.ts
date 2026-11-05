import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CannotCreateChatWithSelfError,
  ChatNotFoundError,
  ChatParticipantNotFoundError,
  InvalidMessageCursorError,
  InvalidMessageTextError,
} from '../../domain/chats.errors.js';

type ChatsError =
  | CannotCreateChatWithSelfError
  | ChatNotFoundError
  | ChatParticipantNotFoundError
  | InvalidMessageCursorError
  | InvalidMessageTextError;

@Catch(
  CannotCreateChatWithSelfError,
  ChatNotFoundError,
  ChatParticipantNotFoundError,
  InvalidMessageCursorError,
  InvalidMessageTextError,
)
class ChatsExceptionFilter implements ExceptionFilter<ChatsError> {
  catch(error: ChatsError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const isNotFound =
      error instanceof ChatNotFoundError ||
      error instanceof ChatParticipantNotFoundError;
    const statusCode = isNotFound ? 404 : 400;

    response.status(statusCode).json({
      statusCode,
      message: error.message,
      error: isNotFound ? 'Not Found' : 'Bad Request',
    });
  }
}

export { ChatsExceptionFilter };
