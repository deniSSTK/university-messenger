import { EventEmitter } from 'node:events';
import type { ChatEvent, ChatEventsPort } from '../domain/chat-events.port.js';

class ChatEvents implements ChatEventsPort {
  private readonly emitter = new EventEmitter();

  publish(event: ChatEvent): void {
    this.emitter.emit('event', event);
  }

  subscribe(listener: (event: ChatEvent) => void): () => void {
    this.emitter.on('event', listener);

    return () => {
      this.emitter.off('event', listener);
    };
  }
}

export { ChatEvents };
