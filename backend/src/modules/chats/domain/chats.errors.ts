class ChatParticipantNotFoundError extends Error {
  constructor() {
    super('Chat participant not found');
  }
}

class ChatNotFoundError extends Error {
  constructor() {
    super('Chat not found');
  }
}

class CannotCreateChatWithSelfError extends Error {
  constructor() {
    super('Cannot create a chat with yourself');
  }
}

class InvalidMessageTextError extends Error {
  constructor() {
    super(
      'Message text must contain a non-whitespace character and be at most 4000 characters long',
    );
  }
}

class InvalidMessageCursorError extends Error {
  constructor() {
    super('Invalid message cursor');
  }
}

export {
  CannotCreateChatWithSelfError,
  ChatNotFoundError,
  ChatParticipantNotFoundError,
  InvalidMessageCursorError,
  InvalidMessageTextError,
};
