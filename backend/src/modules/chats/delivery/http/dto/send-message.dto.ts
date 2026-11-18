import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import {
  MESSAGE_TEXT_MAX_LENGTH,
  MESSAGE_TEXT_MIN_LENGTH,
} from '../../../domain/chats.constants.js';
import { CHATS_EXAMPLES } from './chats.examples.js';
import { ReplyTargetDto } from './reply-target.dto.js';

class SendMessageDto extends ReplyTargetDto {
  @ApiProperty({
    example: CHATS_EXAMPLES.text,
    minLength: MESSAGE_TEXT_MIN_LENGTH,
    maxLength: MESSAGE_TEXT_MAX_LENGTH,
    pattern: '\\S',
    description:
      'Message text must contain a non-whitespace character. Whitespace and line breaks are preserved.',
  })
  @IsString()
  @Length(MESSAGE_TEXT_MIN_LENGTH, MESSAGE_TEXT_MAX_LENGTH)
  @Matches(/\S/u, { message: 'text must contain a non-whitespace character' })
  text!: string;
}

export { SendMessageDto };
