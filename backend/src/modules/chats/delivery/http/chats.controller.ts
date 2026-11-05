import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_MAX_LIMIT,
  PAGINATION_MAX_PAGE,
  PAGINATION_MIN_LIMIT,
  PAGINATION_MIN_PAGE,
} from '../../../../core/pagination/dto/pagination.constants.js';
import { PAGINATION_EXAMPLES } from '../../../../core/pagination/dto/pagination.examples.js';
import { AccessTokenGuard } from '../../../auth/delivery/http/guards/access-token.guard.js';
import type { AuthenticatedRequest } from '../../../auth/delivery/http/auth-http.types.js';
import { ChatsService } from '../../service/chats.service.js';
import {
  CHAT_HISTORY_DEFAULT_LIMIT,
  CHAT_HISTORY_MAX_LIMIT,
} from './dto/chats.constants.js';
import { CHATS_EXAMPLES } from './dto/chats.examples.js';
import { ChatMemberGuard } from './guards/chat-member.guard.js';
import { ChatsExceptionFilter } from './chats-exception.filter.js';
import { ChatIdParamsDto } from './dto/chat-id-params.dto.js';
import { CreateChatDto } from './dto/create-chat.dto.js';
import {
  ChatParticipantDto,
  CreateChatResponseDto,
  ListChatsResponseDto,
  ListMessagesResponseDto,
  SendMessageResponseDto,
} from './dto/chats-response.dto.js';
import { ListChatsRequestDto } from './dto/list-chats-request.dto.js';
import { ListMessagesRequestDto } from './dto/list-messages-request.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@ApiTags('Chats')
@ApiBearerAuth()
@Controller('chats')
@UseGuards(AccessTokenGuard)
@UseFilters(ChatsExceptionFilter)
class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a private chat or return the existing one',
  })
  @ApiCreatedResponse({ type: CreateChatResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid recipient ID or the current user cannot start a chat with themselves.',
  })
  @ApiNotFoundResponse({
    description: 'The recipient does not exist or is not active.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid or expired access token or inactive session.',
  })
  async create(
    @Body() dto: CreateChatDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateChatResponseDto> {
    const currentUserId = request.auth.user.id;
    const chat = await this.chats.createChat({
      currentUserId,
      recipientId: dto.recipientId,
    });
    const recipient = chat.participants.find(
      (participant) => participant.id !== currentUserId,
    );

    if (!recipient) {
      throw new Error(`Private chat ${chat.id} has no other participant`);
    }

    return {
      id: chat.id,
      createdAt: chat.createdAt,
      recipient: {
        id: recipient.id,
        username: recipient.username,
        displayName: recipient.displayName,
      } satisfies ChatParticipantDto,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List the current user’s private chats by recent activity',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    minimum: PAGINATION_MIN_PAGE,
    maximum: PAGINATION_MAX_PAGE,
    default: PAGINATION_DEFAULT_PAGE,
    example: PAGINATION_EXAMPLES.page,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: PAGINATION_MIN_LIMIT,
    maximum: PAGINATION_MAX_LIMIT,
    default: PAGINATION_DEFAULT_LIMIT,
    example: PAGINATION_EXAMPLES.limit,
  })
  @ApiOkResponse({ type: ListChatsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters.' })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid or expired access token or inactive session.',
  })
  async list(
    @Query() query: ListChatsRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ListChatsResponseDto> {
    const result = await this.chats.listChats({
      currentUserId: request.auth.user.id,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Post(':chatId/messages')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Send a message to a private chat' })
  @ApiParam({
    name: 'chatId',
    format: 'uuid',
    example: CHATS_EXAMPLES.chatId,
  })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid chat ID or message text must contain between 1 and 4000 characters.',
  })
  @ApiNotFoundResponse({
    description: 'The chat does not exist or the current user is not a member.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid or expired access token or inactive session.',
  })
  async sendMessage(
    @Param() params: ChatIdParamsDto,
    @Body() dto: SendMessageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SendMessageResponseDto> {
    return this.chats.sendMessage({
      chatId: params.chatId,
      senderId: request.auth.user.id,
      text: dto.text,
    });
  }

  @Get(':chatId/messages')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({
    summary: 'Get newest chat messages and a cursor for older history',
  })
  @ApiParam({
    name: 'chatId',
    format: 'uuid',
    example: CHATS_EXAMPLES.chatId,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: CHAT_HISTORY_MAX_LIMIT,
    default: CHAT_HISTORY_DEFAULT_LIMIT,
    example: CHAT_HISTORY_DEFAULT_LIMIT,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    maxLength: 256,
    example: CHATS_EXAMPLES.cursor,
    description: 'Opaque cursor from the previous response.',
  })
  @ApiOkResponse({ type: ListMessagesResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid cursor or pagination parameters.',
  })
  @ApiNotFoundResponse({
    description: 'The chat does not exist or the current user is not a member.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid or expired access token or inactive session.',
  })
  async listMessages(
    @Param() params: ChatIdParamsDto,
    @Query() query: ListMessagesRequestDto,
  ): Promise<ListMessagesResponseDto> {
    return this.chats.listMessages({
      chatId: params.chatId,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}

export { ChatsController };
