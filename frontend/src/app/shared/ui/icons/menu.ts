import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-menu',
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
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconMenu {}
export { IconMenu };
