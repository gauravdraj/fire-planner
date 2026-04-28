import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function resolveThemePreference(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'dark') {
    return 'dark';
  }

  if (preference === 'system' && systemPrefersDark) {
    return 'dark';
  }

  return 'light';
}

export function applyThemeToRoot(resolvedTheme: ResolvedTheme, root = getDocumentElement()) {
  if (root === null) {
    return;
  }

  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
}

export function useResolvedTheme(preference: ThemePreference): ResolvedTheme {
  const [systemPrefersDark, setSystemPrefersDark] = useState(readSystemPrefersDark);
  const resolvedTheme = resolveThemePreference(preference, systemPrefersDark);

  useEffect(() => {
    const mediaQuery = getThemeMediaQueryList();

    if (mediaQuery === null) {
      return undefined;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    setSystemPrefersDark(mediaQuery.matches);
    addMediaQueryChangeListener(mediaQuery, handleChange);

    return () => {
      removeMediaQueryChangeListener(mediaQuery, handleChange);
    };
  }, []);

  useEffect(() => {
    applyThemeToRoot(resolvedTheme);
  }, [resolvedTheme]);

  return resolvedTheme;
}

function readSystemPrefersDark(): boolean {
  return getThemeMediaQueryList()?.matches ?? false;
}

function getThemeMediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia(THEME_MEDIA_QUERY);
}

function getDocumentElement(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document.documentElement;
}

function addMediaQueryChangeListener(
  mediaQuery: MediaQueryList,
  listener: (event: MediaQueryListEvent) => void,
) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
    return;
  }

  mediaQuery.addListener(listener);
}

function removeMediaQueryChangeListener(
  mediaQuery: MediaQueryList,
  listener: (event: MediaQueryListEvent) => void,
) {
  if (typeof mediaQuery.removeEventListener === 'function') {
    mediaQuery.removeEventListener('change', listener);
    return;
  }

  mediaQuery.removeListener(listener);
}
