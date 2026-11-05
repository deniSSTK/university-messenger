interface ChatPerson {
  id: string;
  username: string;
  displayName: string;
}
interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}
interface Conversation {
  id: string;
  person: ChatPerson;
  lastMessage: ChatMessage | null;
  activityAt: string;
}
interface ChatPage {
  chats: Conversation[];
  hasMore: boolean;
}
interface HistoryPage {
  messages: ChatMessage[];
  nextBefore: string | null;
}
export type { ChatPerson, ChatMessage, Conversation, ChatPage, HistoryPage };
