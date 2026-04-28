import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installMemoryLocalStorage } from './memoryStorage';

describe('uiStore', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
  });

  it('defaults to Plan view, Basic compatibility mode, verdict layout, collapsed advanced details, real-dollar display, and system theme', async () => {
    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().view).toBe('plan');
    expect(useUiStore.getState().mode).toBe('basic');
    expect(useUiStore.getState().displayUnit).toBe('real');
    expect(useUiStore.getState().layout).toBe('verdict');
    expect(useUiStore.getState().advancedDisclosed).toBe(false);
    expect(useUiStore.getState().themePreference).toBe('system');
  });

  it('persists UI preferences under a stable localStorage key', async () => {
    const { UI_STORAGE_KEY, useUiStore } = await import('@/store/uiStore');

    useUiStore.getState().setMode('advanced');
    useUiStore.getState().setDisplayUnit('nominal');
    useUiStore.getState().setLayout('verdict');
    useUiStore.getState().setAdvancedDisclosed(true);
    useUiStore.getState().setThemePreference('dark');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toEqual({
      mode: 'advanced',
      view: 'plan',
      displayUnit: 'nominal',
      layout: 'verdict',
      advancedDisclosed: true,
      themePreference: 'dark',
    });

    vi.resetModules();

    const { useUiStore: reloadedUiStore } = await import('@/store/uiStore');

    expect(reloadedUiStore.getState().mode).toBe('advanced');
    expect(reloadedUiStore.getState().view).toBe('plan');
    expect(reloadedUiStore.getState().displayUnit).toBe('nominal');
    expect(reloadedUiStore.getState().layout).toBe('verdict');
    expect(reloadedUiStore.getState().advancedDisclosed).toBe(true);
    expect(reloadedUiStore.getState().themePreference).toBe('dark');
  });

  it('accepts Methodology as a persisted planner view', async () => {
    const { UI_STORAGE_KEY, useUiStore } = await import('@/store/uiStore');

    useUiStore.getState().setView('methodology');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toMatchObject({
      mode: 'methodology',
      view: 'methodology',
    });

    vi.resetModules();

    const { useUiStore: reloadedUiStore } = await import('@/store/uiStore');

    expect(reloadedUiStore.getState().mode).toBe('methodology');
    expect(reloadedUiStore.getState().view).toBe('methodology');
  });

  it('keeps mode and setMode as compatibility APIs derived from view plus advanced disclosure', async () => {
    const { useUiStore } = await import('@/store/uiStore');

    useUiStore.getState().setMode('advanced');
    expect(useUiStore.getState()).toMatchObject({
      advancedDisclosed: true,
      mode: 'advanced',
      view: 'plan',
    });

    useUiStore.getState().setView('compare');
    expect(useUiStore.getState()).toMatchObject({
      advancedDisclosed: true,
      mode: 'compare',
      view: 'compare',
    });

    useUiStore.getState().setMode('basic');
    expect(useUiStore.getState()).toMatchObject({
      advancedDisclosed: false,
      mode: 'basic',
      view: 'plan',
    });
  });

  it('hydrates older UI preference payloads without layout, view, or theme preference', async () => {
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
    expect(useUiStore.getState().view).toBe('plan');
    expect(useUiStore.getState().displayUnit).toBe('nominal');
    expect(useUiStore.getState().layout).toBe('verdict');
    expect(useUiStore.getState().advancedDisclosed).toBe(true);
    expect(useUiStore.getState().themePreference).toBe('system');

    useUiStore.getState().setThemePreference('light');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toEqual({
      mode: 'advanced',
      view: 'plan',
      displayUnit: 'nominal',
      layout: 'verdict',
      advancedDisclosed: true,
      themePreference: 'light',
    });
  });

  it('preserves explicit persisted layout preferences while adding missing fields', async () => {
    const { UI_STORAGE_KEY } = await import('@/store/uiStore');

    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        view: 'compare',
        displayUnit: 'nominal',
        layout: 'classic',
        advancedDisclosed: true,
        themePreference: 'dark',
      }),
    );

    vi.resetModules();

    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().view).toBe('compare');
    expect(useUiStore.getState().mode).toBe('compare');
    expect(useUiStore.getState().displayUnit).toBe('nominal');
    expect(useUiStore.getState().layout).toBe('classic');
    expect(useUiStore.getState().advancedDisclosed).toBe(true);
    expect(useUiStore.getState().themePreference).toBe('dark');

    useUiStore.getState().setThemePreference('light');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toEqual({
      mode: 'compare',
      view: 'compare',
      displayUnit: 'nominal',
      layout: 'classic',
      advancedDisclosed: true,
      themePreference: 'light',
    });
  });

  it('preserves an explicit persisted verdict layout preference', async () => {
    const { UI_STORAGE_KEY } = await import('@/store/uiStore');

    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        layout: 'verdict',
      }),
    );

    vi.resetModules();

    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().layout).toBe('verdict');
  });

  it('ignores invalid persisted theme preferences', async () => {
    const { UI_STORAGE_KEY } = await import('@/store/uiStore');

    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        mode: 'advanced',
        displayUnit: 'nominal',
        layout: 'immersive',
        advancedDisclosed: 'yes',
        themePreference: 'sepia',
      }),
    );

    vi.resetModules();

    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().themePreference).toBe('system');
    expect(useUiStore.getState().view).toBe('plan');
    expect(useUiStore.getState().layout).toBe('verdict');
    expect(useUiStore.getState().advancedDisclosed).toBe(true);
  });
});
