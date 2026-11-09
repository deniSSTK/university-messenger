import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-edit',
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
    <path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconEdit {}
export { IconEdit };
