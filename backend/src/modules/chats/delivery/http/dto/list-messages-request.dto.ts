import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toDecimalInteger } from '../../../../../common/utils/number.transforms.js';
import {
  CHAT_HISTORY_DEFAULT_LIMIT,
  CHAT_HISTORY_MAX_LIMIT,
} from './chats.constants.js';
import { CHATS_EXAMPLES } from './chats.examples.js';

class ListMessagesRequestDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: CHAT_HISTORY_MAX_LIMIT,
    default: CHAT_HISTORY_DEFAULT_LIMIT,
    example: CHAT_HISTORY_DEFAULT_LIMIT,
  })
  @Transform(toDecimalInteger)
  @IsInt()
  @Min(1)
  @Max(CHAT_HISTORY_MAX_LIMIT)
  limit: number = CHAT_HISTORY_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    example: CHATS_EXAMPLES.cursor,
    maxLength: 256,
    description:
      'Opaque cursor returned by the previous page. Messages are ordered newest first.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  cursor?: string;
}

export { ListMessagesRequestDto };
