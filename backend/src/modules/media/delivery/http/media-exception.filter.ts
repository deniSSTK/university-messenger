import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Response } from 'express';
import { MediaUnavailableError } from '../../domain/object-storage.port.js';
@Catch(MediaUnavailableError)
class MediaExceptionFilter implements ExceptionFilter<MediaUnavailableError> {
  catch(_error: MediaUnavailableError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(503).json({
      statusCode: 503,
      message: 'File storage is temporarily unavailable',
      error: 'Service Unavailable',
    });
  }
}
export { MediaExceptionFilter };
