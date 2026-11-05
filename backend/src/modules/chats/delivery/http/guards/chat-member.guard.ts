import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../../../../auth/delivery/http/auth-http.types.js';
import { ChatsService } from '../../../service/chats.service.js';

type ChatRequest = AuthenticatedRequest & {
  params: {
    chatId?: string;
  };
};

@Injectable()
class ChatMemberGuard implements CanActivate {
  constructor(private readonly chats: ChatsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ChatRequest>();
    const chatId = request.params.chatId;

    if (!chatId || !isUUID(chatId)) {
      throw new BadRequestException('chatId must be a UUID');
    }

    const isMember = await this.chats.isActiveMember(
      chatId,
      request.auth.user.id,
    );

    if (!isMember) {
      throw new NotFoundException('Chat not found');
    }

    return true;
  }
}

export { ChatMemberGuard };
