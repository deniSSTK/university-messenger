import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
class ThemeService {
  private readonly storage = inject(LocalStorageService);
  private readonly storageKey = 'neon-orbs-theme';
  readonly theme = signal<Theme>(this.getInitialTheme());
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      const current = this.theme();

      document.documentElement.setAttribute('data-theme', current);
      this.storage.setItem(this.storageKey, current);
    });
  }

  toggleTheme(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  private getInitialTheme(): Theme {
    const saved = this.storage.getItem(this.storageKey);

    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    return prefersDark ? 'dark' : 'light';
  }
}

export { ThemeService };
export type { Theme };
