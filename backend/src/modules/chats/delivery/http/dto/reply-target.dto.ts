import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';
import { UUID_EXAMPLE } from '../../../../../core/examples/uuid.examples.js';

class ReplyTargetDto {
  @ApiPropertyOptional({ format: 'uuid', example: UUID_EXAMPLE })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID('4')
  replyToId?: string;
}

export { ReplyTargetDto };
