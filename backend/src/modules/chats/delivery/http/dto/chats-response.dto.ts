import { ApiProperty } from '@nestjs/swagger';
import { UUID } from '../../../../../core/decorators/uuid.decorator.js';
import { PaginatedResponseDto } from '../../../../../core/pagination/dto/paginated-response.dto.js';
import { PaginationMetaDto } from '../../../../../core/pagination/dto/pagination-meta.dto.js';
import { CHATS_EXAMPLES } from './chats.examples.js';

class ChatParticipantDto {
  @UUID()
  id!: string;

  @ApiProperty({ example: CHATS_EXAMPLES.username })
  username!: string;

  @ApiProperty({ example: CHATS_EXAMPLES.displayName })
  displayName!: string;
}

class ChatMessageDto {
  @UUID()
  id!: string;

  @UUID()
  chatId!: string;

  @ApiProperty({ example: CHATS_EXAMPLES.text })
  text!: string;

  @UUID()
  senderId!: string;

  @ApiProperty({ type: ChatParticipantDto })
  sender!: ChatParticipantDto;

  @ApiProperty({
    example: CHATS_EXAMPLES.createdAt,
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    example: null,
    type: String,
    format: 'date-time',
    nullable: true,
  })
  editedAt!: Date | null;
}

class ChatListItemDto {
  @UUID()
  id!: string;

  @ApiProperty({ type: ChatParticipantDto })
  recipient!: ChatParticipantDto;

  @ApiProperty({ type: ChatMessageDto, nullable: true })
  lastMessage!: ChatMessageDto | null;

  @ApiProperty({
    example: CHATS_EXAMPLES.createdAt,
    type: String,
    format: 'date-time',
  })
  lastActivityAt!: Date;
}

class ListChatsResponseDto extends PaginatedResponseDto<ChatListItemDto> {
  @ApiProperty({ type: () => ChatListItemDto, isArray: true })
  declare items: ChatListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  declare meta: PaginationMetaDto;
}

class ChatDetailsResponseDto {
  @UUID()
  id!: string;

  @ApiProperty({
    example: CHATS_EXAMPLES.createdAt,
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({ type: ChatParticipantDto })
  recipient!: ChatParticipantDto;
}

class CreateChatResponseDto extends ChatDetailsResponseDto {}

class SendMessageResponseDto extends ChatMessageDto {}

class ListMessagesResponseDto {
  @ApiProperty({ type: () => ChatMessageDto, isArray: true })
  items!: ChatMessageDto[];

  @ApiProperty({
    type: String,
    example: CHATS_EXAMPLES.cursor,
    nullable: true,
    description:
      'Cursor for the next older page, or null when there are no more.',
  })
  nextCursor!: string | null;
}

export {
  ChatListItemDto,
  ChatDetailsResponseDto,
  ChatMessageDto,
  ChatParticipantDto,
  CreateChatResponseDto,
  ListChatsResponseDto,
  ListMessagesResponseDto,
  SendMessageResponseDto,
};
