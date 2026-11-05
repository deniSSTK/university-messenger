import { Component, computed, input } from '@angular/core';
const ICON_PATHS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  back: 'M19 12H5m7-7-7 7 7 7',
  clear: 'm6 6 12 12M18 6 6 18',
  search: 'M17 10a7 7 0 1 1-14 0a7 7 0 0 1 14 0ZM15 15l6 6',
  refresh: 'M3 12a9 9 0 0 1 15.36-6.36L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.36 6.36L3 16M8 16H3v5',
  send: 'M3 11.5 21 3l-8.5 18-2-7.5L3 11.5ZM10.5 13.5 21 3',
  down: 'M12 4v16m-6-6 6 6 6-6',
  logout: 'M9 5H4v14h5m7-14 7 7-7 7M8 12h14',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  chat: 'M21 11a9 9 0 0 1-9 9H4l-2 2v-11a9 9 0 0 1 19 0Z',
};
type ChatIconName = keyof typeof ICON_PATHS;
@Component({
  selector: 'app-chat-icon',
  standalone: true,
  template: ` <svg
    viewBox="0 0 24 24"
    preserveAspectRatio="xMidYMid meet"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @if (name() === 'more') {
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="5" r="1.9" />
        <circle cx="12" cy="12" r="1.9" />
        <circle cx="12" cy="19" r="1.9" />
      </g>
    } @else {
      <path [attr.d]="path()" [attr.transform]="name() === 'send' ? 'translate(-1 2)' : null" />
    }
  </svg>`,
  styles: [
    ':host { display: inline-flex; width: 24px; height: 24px; flex-shrink: 0; } svg { display: block; width: 24px; height: 24px; flex-shrink: 0; }',
  ],
})
class ChatIcon {
  readonly name = input.required<ChatIconName>();
  readonly path = computed(() => ICON_PATHS[this.name()]);
}
export { ChatIcon };
