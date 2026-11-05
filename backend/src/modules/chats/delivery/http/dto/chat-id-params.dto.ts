import { UUID } from '../../../../../core/decorators/uuid.decorator.js';

class ChatIdParamsDto {
  @UUID()
  chatId!: string;
}

export { ChatIdParamsDto };
