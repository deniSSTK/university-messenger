import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { MessageView } from './chats-view.types';
@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [DatePipe],
  template: `<article class="message" [class.own]="own()">
    <p>{{ message().text }}</p>
    <time
      [attr.datetime]="message().createdAt"
      [attr.title]="message().createdAt | date: 'dd.MM.yyyy HH:mm'"
      >{{ message().createdAt | date: 'HH:mm' }}</time
    >
  </article>`,
  styleUrl: './chat-bubble.scss',
})
class ChatBubble {
  readonly message = input.required<MessageView>();
  readonly own = input(false);
}
export { ChatBubble };
