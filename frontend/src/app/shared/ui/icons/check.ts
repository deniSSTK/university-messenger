import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-check',
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
    <path d="m5 12 4 4L19 6" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconCheck {}
export { IconCheck };
