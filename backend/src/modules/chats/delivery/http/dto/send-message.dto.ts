import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import {
  MESSAGE_TEXT_MAX_LENGTH,
  MESSAGE_TEXT_MIN_LENGTH,
} from '../../../domain/chats.constants.js';
import { CHATS_EXAMPLES } from './chats.examples.js';

class SendMessageDto {
  @ApiProperty({
    example: CHATS_EXAMPLES.text,
    minLength: MESSAGE_TEXT_MIN_LENGTH,
    maxLength: MESSAGE_TEXT_MAX_LENGTH,
    description: 'Message text; whitespace is preserved.',
  })
  @IsString()
  @Length(MESSAGE_TEXT_MIN_LENGTH, MESSAGE_TEXT_MAX_LENGTH)
  text!: string;
}

export { SendMessageDto };
