import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-search',
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
    <path d="M17 10a7 7 0 1 1-14 0a7 7 0 0 1 14 0ZM15 15l6 6" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconSearch {}
export { IconSearch };
