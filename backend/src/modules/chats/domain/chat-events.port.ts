import { WebSocketEventType } from '@university-messenger/events';
import type { ReactionSnapshot } from './message-reactions.js';

type ChatActivityEvent = {
  type: WebSocketEventType.Changed | WebSocketEventType.Typing;
  chatId: string;
  messageId?: string;
  userId?: string;
  typing?: boolean;
};
type ReactionEvent = Omit<ReactionSnapshot, 'changed'> & {
  type: WebSocketEventType.Reaction;
  chatId: string;
  messageId: string;
};
type ChatEvent = ChatActivityEvent | ReactionEvent;
interface ChatEventsPort {
  publish(event: ChatEvent): void;
}

export type { ChatEvent, ChatEventsPort };
