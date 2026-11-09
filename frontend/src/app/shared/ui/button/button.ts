import { Component, ChangeDetectionStrategy, input, booleanAttribute } from '@angular/core';
import { Spinner } from '../spinner/spinner';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon' | 'bare';
@Component({
  selector: 'button[appButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner],
  template: `@if (busy()) {
      <app-spinner />
    }
    <ng-content />`,
  styleUrl: './button.scss',
  host: {
    '[attr.data-variant]': 'variant()',
    '[disabled]': 'disabled() || busy()',
    '[attr.aria-busy]': 'busy() || null',
    '[attr.type]': 'type()',
  },
})
class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly busy = input(false, { transform: booleanAttribute });
  readonly type = input<'button' | 'submit' | 'reset'>('button');
}
export { Button };
export type { ButtonVariant };
