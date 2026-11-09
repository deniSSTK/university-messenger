interface PersonView {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
interface MessageView {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  readAt?: string | null;
  attachment?: { name: string; mediaType: string; size: number } | null;
}
interface ConversationView {
  id: string;
  person: PersonView;
  lastMessage: MessageView | null;
  activityAt: string;
  unreadCount?: number;
}

export type { PersonView, MessageView, ConversationView };
