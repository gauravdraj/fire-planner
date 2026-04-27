import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installMemoryLocalStorage } from './memoryStorage';

describe('uiStore', () => {
  beforeEach(() => {
    vi.resetModules();
    installMemoryLocalStorage();
  });

  it('defaults to Basic mode and real-dollar display', async () => {
    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().mode).toBe('basic');
    expect(useUiStore.getState().displayUnit).toBe('real');
  });

  it('persists UI preferences under a stable localStorage key', async () => {
    const { UI_STORAGE_KEY, useUiStore } = await import('@/store/uiStore');

    useUiStore.getState().setMode('advanced');
    useUiStore.getState().setDisplayUnit('nominal');

    expect(JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}')).toEqual({
      mode: 'advanced',
      displayUnit: 'nominal',
    });

    vi.resetModules();

    const { useUiStore: reloadedUiStore } = await import('@/store/uiStore');

    expect(reloadedUiStore.getState().mode).toBe('advanced');
    expect(reloadedUiStore.getState().displayUnit).toBe('nominal');
  });
});
