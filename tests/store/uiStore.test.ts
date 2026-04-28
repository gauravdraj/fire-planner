import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installMemoryLocalStorage } from './memoryStorage';

describe('uiStore', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
  });

  it('defaults to Basic mode, real-dollar display, and system theme', async () => {
    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().mode).toBe('basic');
    expect(useUiStore.getState().displayUnit).toBe('real');
    expect(useUiStore.getState().themePreference).toBe('system');
  });

  it('persists UI preferences under a stable localStorage key', async () => {
    const { UI_STORAGE_KEY, useUiStore } = await import('@/store/uiStore');

    useUiStore.getState().setMode('advanced');
    useUiStore.getState().setDisplayUnit('nominal');
    useUiStore.getState().setThemePreference('dark');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toEqual({
      mode: 'advanced',
      displayUnit: 'nominal',
      themePreference: 'dark',
    });

    vi.resetModules();

    const { useUiStore: reloadedUiStore } = await import('@/store/uiStore');

    expect(reloadedUiStore.getState().mode).toBe('advanced');
    expect(reloadedUiStore.getState().displayUnit).toBe('nominal');
    expect(reloadedUiStore.getState().themePreference).toBe('dark');
  });

  it('accepts Methodology as a persisted planner mode', async () => {
    const { UI_STORAGE_KEY, useUiStore } = await import('@/store/uiStore');

    useUiStore.getState().setMode('methodology');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({ mode: 'methodology' });

    vi.resetModules();

    const { useUiStore: reloadedUiStore } = await import('@/store/uiStore');

    expect(reloadedUiStore.getState().mode).toBe('methodology');
  });

  it('hydrates older UI preference payloads without a theme preference', async () => {
    const { UI_STORAGE_KEY } = await import('@/store/uiStore');

    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        mode: 'advanced',
        displayUnit: 'nominal',
      }),
    );

    vi.resetModules();

    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().mode).toBe('advanced');
    expect(useUiStore.getState().displayUnit).toBe('nominal');
    expect(useUiStore.getState().themePreference).toBe('system');

    useUiStore.getState().setThemePreference('light');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toEqual({
      mode: 'advanced',
      displayUnit: 'nominal',
      themePreference: 'light',
    });
  });

  it('ignores invalid persisted theme preferences', async () => {
    const { UI_STORAGE_KEY } = await import('@/store/uiStore');

    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        mode: 'advanced',
        displayUnit: 'nominal',
        themePreference: 'sepia',
      }),
    );

    vi.resetModules();

    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().themePreference).toBe('system');
  });
});
