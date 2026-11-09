import { UUID } from '../../../../../core/decorators/uuid.decorator.js';
import { ChatIdParamsDto } from './chat-id-params.dto.js';
class MessageParamsDto extends ChatIdParamsDto {
  @UUID()
  messageId!: string;
}
class ReadMessagesDto {
  @UUID()
  throughMessageId!: string;
}

export { MessageParamsDto, ReadMessagesDto };
