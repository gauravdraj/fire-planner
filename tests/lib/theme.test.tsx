import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ThemePreference } from '@/lib/theme';
import { applyThemeToRoot, resolveThemePreference, THEME_MEDIA_QUERY, useResolvedTheme } from '@/lib/theme';
import { getMockMatchMediaListenerCount, setMockPrefersColorSchemeDark } from '@/test/matchMediaMock';

describe('theme helpers', () => {
  afterEach(() => {
    cleanup();
  });

  it('resolves explicit and system theme preferences', () => {
    expect(resolveThemePreference('light', true)).toBe('light');
    expect(resolveThemePreference('dark', false)).toBe('dark');
    expect(resolveThemePreference('system', false)).toBe('light');
    expect(resolveThemePreference('system', true)).toBe('dark');
  });

  it('applies the resolved theme to the root element', () => {
    applyThemeToRoot('dark');

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyThemeToRoot('light');

    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('tracks system theme changes and removes the media listener on unmount', () => {
    setMockPrefersColorSchemeDark(false);

    const { unmount } = render(<ThemeProbe preference="system" />);

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(getMockMatchMediaListenerCount(THEME_MEDIA_QUERY)).toBe(1);

    act(() => {
      setMockPrefersColorSchemeDark(true);
    });

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');

    unmount();

    expect(getMockMatchMediaListenerCount(THEME_MEDIA_QUERY)).toBe(0);
  });

  it('keeps explicit light preference stable when the system changes', () => {
    setMockPrefersColorSchemeDark(false);

    render(<ThemeProbe preference="light" />);

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');

    act(() => {
      setMockPrefersColorSchemeDark(true);
    });

    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

function ThemeProbe({ preference }: { preference: ThemePreference }) {
  const resolvedTheme = useResolvedTheme(preference);

  return <div data-testid="resolved-theme">{resolvedTheme}</div>;
}
