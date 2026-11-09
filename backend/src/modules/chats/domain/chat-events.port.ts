import { WebSocketEventType } from '@university-messenger/events';
type ChatEvent = {
  type: WebSocketEventType.Changed | WebSocketEventType.Typing;
  chatId: string;
  userId?: string;
  typing?: boolean;
};
interface ChatEventsPort {
  publish(event: ChatEvent): void;
}

export type { ChatEvent, ChatEventsPort };
