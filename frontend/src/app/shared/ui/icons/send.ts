import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-send',
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
    <path d="M3 11.5 21 3l-8.5 18-2-7.5L3 11.5ZM10.5 13.5 21 3" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconSend {}
export { IconSend };
