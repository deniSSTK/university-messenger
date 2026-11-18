enum WebSocketEventType {
  Auth = 'auth',
  Ready = 'ready',
  Changed = 'changed',
  Reaction = 'message:reaction:update',
  Typing = 'typing',
  // Emitted locally by the client transport when its connection closes.
  Offline = 'offline',
}

export { WebSocketEventType };
