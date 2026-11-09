import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { IconPaperclip } from '../icons/paperclip';
@Component({
  selector: 'app-file-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconPaperclip],
  template: `<label
    ><app-icon-paperclip /><span>{{ label() }}</span>
    @if (hint()) {
      <small>{{ hint() }}</small>
    }
    <input
      type="file"
      [accept]="accept()"
      [disabled]="disabled()"
      [attr.aria-label]="label()"
      (change)="select($event)"
  /></label>`,
  styleUrl: './file-picker.scss',
})
class FilePicker {
  readonly label = input('Прикріпити файл');
  readonly hint = input('');
  readonly accept = input('');
  readonly disabled = input(false);
  readonly fileSelected = output<Event>();
  select(event: Event): void {
    this.fileSelected.emit(event);
    if (event.target instanceof HTMLInputElement) {
      event.target.value = '';
    }
  }
}
export { FilePicker };
