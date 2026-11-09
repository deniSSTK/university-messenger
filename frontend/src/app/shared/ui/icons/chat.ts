import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-chat',
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
    <path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-11a9 9 0 0 1 19 0Z" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconChat {}
export { IconChat };
