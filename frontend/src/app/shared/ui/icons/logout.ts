import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-logout',
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
    <path d="M9 5H4v14h5m7-14 7 7-7 7M8 12h14" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconLogout {}
export { IconLogout };
