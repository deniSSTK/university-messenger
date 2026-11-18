import { Component, input, output } from '@angular/core';
import { REACTION_TYPES } from '@university-messenger/events';
import type { ReactionType } from '@university-messenger/events';

const REACTION_LABELS: Record<ReactionType, { emoji: string; name: string }> = {
  HEART: { emoji: '❤️', name: 'Серце' },
  CLOWN: { emoji: '🤡', name: 'Клоун' },
  THUMBS_UP: { emoji: '👍', name: 'Подобається' },
  THUMBS_DOWN: { emoji: '👎', name: 'Не подобається' },
  FIRE: { emoji: '🔥', name: 'Вогонь' },
  SMILING_FACE_WITH_HEARTS: { emoji: '🥰', name: 'Усмішка з сердечками' },
  CLAP: { emoji: '👏', name: 'Оплески' },
};

@Component({
  selector: 'app-chat-reaction-picker',
  template: `
    <div class="picker" role="group" [attr.aria-label]="label()">
      @for (type of types; track type) {
        <button
          type="button"
          [attr.aria-label]="labels[type].name"
          [title]="labels[type].name"
          [attr.aria-pressed]="selected() === type"
          [disabled]="disabled()"
          (click)="picked.emit(type)"
        >
          <span aria-hidden="true">{{ labels[type].emoji }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './chat-reaction-picker.scss',
})
class ChatReactionPicker {
  readonly selected = input<ReactionType | null>(null);
  readonly disabled = input(false);
  readonly label = input('Реакції');
  readonly picked = output<ReactionType>();
  readonly types = REACTION_TYPES;
  readonly labels = REACTION_LABELS;
}

export { ChatReactionPicker, REACTION_LABELS };
