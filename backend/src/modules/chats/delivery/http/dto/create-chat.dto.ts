import { UUID } from '../../../../../core/decorators/uuid.decorator.js';

class CreateChatDto {
  @UUID()
  recipientId!: string;
}

export { CreateChatDto };
