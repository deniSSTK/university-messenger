import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
class ChatDrafts {
  readonly errors = signal<ReadonlyMap<string, string>>(new Map());
  private values = new Map<string, string>();
  readonly pending = signal<ReadonlySet<string>>(new Set());
  get(owner: string, chatId: string) {
    return this.values.get(`${owner}:${chatId}`) ?? '';
  }
  set(owner: string, chatId: string, text: string) {
    this.values.set(`${owner}:${chatId}`, text);
  }
  begin(chatId: string) {
    this.pending.update((current) => new Set([...current, chatId]));
  }
  end(chatId: string) {
    this.pending.update((current) => new Set([...current].filter((id) => id !== chatId)));
  }
  clear() {
    this.values.clear();
  }
}
export { ChatDrafts };
