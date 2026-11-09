import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-paperclip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconPaperclip {}
export { IconPaperclip };
