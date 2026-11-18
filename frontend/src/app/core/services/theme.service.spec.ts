import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const storageKey = 'neon-orbs-theme';

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('initializes from the stored theme and keeps the raw storage format', () => {
    window.localStorage.setItem(storageKey, 'dark');

    const themeService = TestBed.inject(ThemeService);

    expect(themeService.theme()).toBe('dark');
    expect(themeService.isDark()).toBe(true);
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(storageKey)).toBe('dark');
  });

  it('persists theme changes through LocalStorageService', () => {
    const storage = TestBed.inject(LocalStorageService);
    const setItem = vi.spyOn(storage, 'setItem');
    const themeService = TestBed.inject(ThemeService);

    TestBed.tick();
    themeService.toggleTheme();
    TestBed.tick();

    expect(themeService.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(setItem).toHaveBeenLastCalledWith(storageKey, 'dark');
  });
});
