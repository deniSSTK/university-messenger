import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CHATS_EXAMPLES } from './chats.examples.js';

class CreateChatDto {
  @ApiProperty({
    example: CHATS_EXAMPLES.recipientId,
    format: 'uuid',
    description: 'The other user in the private conversation.',
  })
  @IsUUID()
  recipientId!: string;
}

export { CreateChatDto };
