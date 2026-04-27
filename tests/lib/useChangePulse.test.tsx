import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChangePulse } from '@/lib/useChangePulse';

describe('useChangePulse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false on initial render', () => {
    const { result } = renderHook(() => useChangePulse(1));

    expect(result.current).toBe(false);
  });

  it('pulses on the first value change and returns to false after the duration', () => {
    const { result, rerender } = renderHook(({ value }) => useChangePulse(value, 100), {
      initialProps: { value: 1 },
    });

    act(() => {
      rerender({ value: 2 });
    });

    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(99);
    });

    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe(false);
  });

  it('restarts the pulse window when values change repeatedly', () => {
    const { result, rerender } = renderHook(({ value }) => useChangePulse(value, 100), {
      initialProps: { value: 'first' },
    });

    act(() => {
      rerender({ value: 'second' });
    });

    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    act(() => {
      rerender({ value: 'third' });
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(40);
    });

    expect(result.current).toBe(false);
  });

  it('cleans up pending timers on unmount', () => {
    const { rerender, unmount } = renderHook(({ value }) => useChangePulse(value, 100), {
      initialProps: { value: 1 },
    });

    act(() => {
      rerender({ value: 2 });
    });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
