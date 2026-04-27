import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedCallback } from '@/lib/useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid calls into one callback invocation', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 150));

    act(() => {
      result.current('first');
      vi.advanceTimersByTime(75);
      result.current('second');
      vi.advanceTimersByTime(75);
      result.current('third');
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('preserves the latest arguments from the final debounced call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 150));

    act(() => {
      result.current('first', 1);
      result.current('latest', 2);
      vi.advanceTimersByTime(150);
    });

    expect(callback).toHaveBeenCalledWith('latest', 2);
  });

  it('cleans up a pending timer on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 150));

    act(() => {
      result.current('pending');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
