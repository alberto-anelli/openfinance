import { writable, type Writable } from 'svelte/store';

export type ThemeName = 'terminal' | 'default';

const STORAGE_KEY = 'bilancio-theme';

function getInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'terminal';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'terminal' || stored === 'default') return stored;
  return 'terminal';
}

function createThemeStore(): Writable<ThemeName> & { toggle: () => void } {
  const store = writable<ThemeName>(getInitialTheme());

  return {
    subscribe: store.subscribe,
    set: (value: ThemeName) => {
      store.set(value);
    },
    update: store.update,
    toggle: () => {
      store.update((current) => {
        const next: ThemeName = current === 'terminal' ? 'default' : 'terminal';
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, next);
        }
        return next;
      });
    },
  };
}

export const theme = createThemeStore();