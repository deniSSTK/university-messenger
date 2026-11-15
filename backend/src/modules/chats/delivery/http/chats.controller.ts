import { ApiServiceUnavailableResponse } from '@nestjs/swagger';
import {
  SendAttachmentDto,
  SendVoiceDto,
  AttachmentResponseDto,
} from './dto/attachment.dto.js';
import { MessageParamsDto, ReadMessagesDto } from './dto/message-params.dto.js';
import {
  Body,
  Patch,
  Delete,
  HttpCode,
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
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UUID_EXAMPLE } from '../../../../core/examples/uuid.examples.js';
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
import type { ChatDetailsResult } from '../../service/chats.types.js';
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
  ChatDetailsResponseDto,
  CreateChatResponseDto,
  ListChatsResponseDto,
  ListMessagesResponseDto,
  SendMessageResponseDto,
  SharedMediaCountsDto,
} from './dto/chats-response.dto.js';
import { ListChatsRequestDto } from './dto/list-chats-request.dto.js';
import { ListMessagesRequestDto } from './dto/list-messages-request.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

function toChatDetailsResponse(
  chat: ChatDetailsResult,
): ChatDetailsResponseDto {
  return {
    id: chat.id,
    createdAt: chat.createdAt,
    recipient: {
      id: chat.recipient.id,
      username: chat.recipient.username,
      displayName: chat.recipient.displayName,
      avatarUrl: chat.recipient.avatarUrl ?? null,
    },
  };
}

@ApiServiceUnavailableResponse({
  description: 'Object storage is temporarily unavailable.',
})
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
    const chat = await this.chats.createChat({
      currentUserId: request.auth.user.id,
      recipientId: dto.recipientId,
    });

    return toChatDetailsResponse(chat);
  }

  @Get(':chatId')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Get a private chat by ID' })
  @ApiParam({ name: 'chatId', format: 'uuid', example: UUID_EXAMPLE })
  @ApiOkResponse({ type: ChatDetailsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid chat ID.' })
  @ApiNotFoundResponse({
    description: 'The chat does not exist or the current user is not a member.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid or expired access token or inactive session.',
  })
  async getChat(
    @Param() params: ChatIdParamsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ChatDetailsResponseDto> {
    const chat = await this.chats.getChat(params.chatId, request.auth.user.id);

    return toChatDetailsResponse(chat);
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

  @Get(':chatId/media')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({
    summary: 'Count available attachments in this chat by category',
  })
  @ApiOkResponse({ type: SharedMediaCountsDto })
  @ApiBadRequestResponse({ description: 'Invalid chat ID.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  @ApiNotFoundResponse({ description: 'Chat not found.' })
  countMedia(@Param() params: ChatIdParamsDto): Promise<SharedMediaCountsDto> {
    return this.chats.countMedia(params.chatId);
  }

  @Delete(':chatId/visibility')
  @HttpCode(204)
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Hide only the current user’s chat list entry' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Invalid chat ID.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  @ApiNotFoundResponse({ description: 'Chat not found.' })
  hideChat(
    @Param() params: ChatIdParamsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.chats.hideChat(params.chatId, request.auth.user.id);
  }

  @Post(':chatId/messages')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Send a message to a private chat' })
  @ApiParam({
    name: 'chatId',
    format: 'uuid',
    example: UUID_EXAMPLE,
  })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid chat ID or text with no non-whitespace character or more than 4000 characters.',
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

  @Post(':chatId/attachments')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Send an image or file up to 5 MiB' })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid file or filename.' })
  @ApiNotFoundResponse({ description: 'Chat not found.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  async sendAttachment(
    @Param() params: ChatIdParamsDto,
    @Body() dto: SendAttachmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SendMessageResponseDto> {
    return this.chats.sendFile({
      chatId: params.chatId,
      senderId: request.auth.user.id,
      name: dto.name,
      mediaType: dto.mediaType,
      bytes: Buffer.from(dto.content, 'base64'),
    });
  }

  @Post(':chatId/voice')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Send a voice recording up to 5 MiB and 5 minutes' })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid audio, format or duration.' })
  @ApiNotFoundResponse({ description: 'Chat or message not found.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  async sendVoice(
    @Param() params: ChatIdParamsDto,
    @Body() dto: SendVoiceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SendMessageResponseDto> {
    return this.chats.sendVoice({
      id: dto.id.toLowerCase(),
      chatId: params.chatId,
      senderId: request.auth.user.id,
      mediaType: dto.mediaType,
      bytes: Buffer.from(dto.content, 'base64'),
    });
  }

  @Get(':chatId/messages/:messageId/attachment')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Download an attachment as base64 (members only)' })
  @ApiOkResponse({ type: AttachmentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid ID.' })
  @ApiNotFoundResponse({
    description: 'Chat, message or attachment not found.',
  })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  async getAttachment(
    @Param() params: MessageParamsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AttachmentResponseDto> {
    const file = await this.chats.getFile(
      params.chatId,
      params.messageId,
      request.auth.user.id,
    );

    return {
      name: file.name,
      mediaType: file.mediaType,
      content: Buffer.from(file.bytes).toString('base64'),
    };
  }

  @Patch(':chatId/messages/:messageId')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Edit your own message' })
  @ApiOkResponse({ type: SendMessageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid ID or message text.' })
  @ApiNotFoundResponse({ description: 'Chat or own message not found.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  async editMessage(
    @Param() params: MessageParamsDto,
    @Body() dto: SendMessageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SendMessageResponseDto> {
    return this.chats.changeMessage({
      chatId: params.chatId,
      messageId: params.messageId,
      userId: request.auth.user.id,
      text: dto.text,
    });
  }

  @Delete(':chatId/messages/:messageId')
  @HttpCode(204)
  @UseGuards(ChatMemberGuard)
  @ApiOperation({ summary: 'Delete your own message' })
  @ApiNoContentResponse({ description: 'Message deleted.' })
  @ApiBadRequestResponse({ description: 'Invalid ID.' })
  @ApiNotFoundResponse({ description: 'Chat or own message not found.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  async deleteMessage(
    @Param() params: MessageParamsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.chats.changeMessage({
      chatId: params.chatId,
      messageId: params.messageId,
      userId: request.auth.user.id,
      text: null,
    });
  }

  @Post(':chatId/read')
  @HttpCode(204)
  @UseGuards(ChatMemberGuard)
  @ApiOperation({
    summary: 'Mark received messages through a displayed message as read',
  })
  @ApiNoContentResponse({ description: 'Read state saved.' })
  @ApiBadRequestResponse({ description: 'Invalid ID.' })
  @ApiNotFoundResponse({ description: 'Chat not found.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  async markRead(
    @Param() params: ChatIdParamsDto,
    @Body() dto: ReadMessagesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.chats.markRead(
      params.chatId,
      request.auth.user.id,
      dto.throughMessageId,
    );
  }

  @Get(':chatId/messages')
  @UseGuards(ChatMemberGuard)
  @ApiOperation({
    summary: 'Get newest chat messages and a cursor for older history',
  })
  @ApiParam({
    name: 'chatId',
    format: 'uuid',
    example: UUID_EXAMPLE,
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
    description: 'Invalid chat ID, cursor or pagination parameters.',
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
      ...(query.category ? { mediaCategory: query.category } : {}),
      limit: query.limit,
    });
  }
}

export { ChatsController };
