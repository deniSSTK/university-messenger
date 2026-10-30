class MessageAccessError extends Error {
  constructor() {
    super('An active chat membership is required');
  }
}

class MessageConflictError extends Error {
  constructor() {
    super('The message ID was already used with a different payload');
  }
}

class MessageShardUnavailableError extends Error {
  constructor() {
    super('The assigned message shard is not configured');
  }
}

export {
  MessageAccessError,
  MessageConflictError,
  MessageShardUnavailableError,
};
