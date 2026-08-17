import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function storedTheme(): Theme {
  const value = localStorage.getItem(KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

/**
 * shadcn switches on a `.dark` class rather than a media query, so the resolved
 * choice has to be stamped onto the root element.
 */
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(storedTheme);

  const setTheme = useCallback((next: Theme) => {
    // "system" is the absence of a preference, so it stores nothing.
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
    setThemeState(next);
    applyTheme(next);
  }, []);

  // Only follow the OS while the choice is actually "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = media();
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return { theme, setTheme };
}
