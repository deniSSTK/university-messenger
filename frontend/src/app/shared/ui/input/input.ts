import { Component, ChangeDetectionStrategy, input } from '@angular/core';
@Component({
  selector: 'input[appInput], textarea[appInput]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styleUrl: './input.scss',
  host: { '[attr.data-appearance]': 'appearance()' },
})
class Input {
  readonly appearance = input<'default' | 'plain'>('default');
}
export { Input };
