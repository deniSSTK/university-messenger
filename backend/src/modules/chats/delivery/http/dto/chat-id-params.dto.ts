import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CHATS_EXAMPLES } from './chats.examples.js';

class ChatIdParamsDto {
  @ApiProperty({ example: CHATS_EXAMPLES.chatId, format: 'uuid' })
  @IsUUID()
  chatId!: string;
}

export { ChatIdParamsDto };
