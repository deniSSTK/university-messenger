interface PersonView {
  id: string;
  username: string;
  displayName: string;
}
interface MessageView {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}
interface ConversationView {
  id: string;
  person: PersonView;
  lastMessage: MessageView | null;
  activityAt: string;
}
export type { PersonView, MessageView, ConversationView };
