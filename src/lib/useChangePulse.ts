import { useEffect, useRef, useState } from 'react';

const DEFAULT_PULSE_DURATION_MS = 700;

export function useChangePulse(value: string | number, durationMs = DEFAULT_PULSE_DURATION_MS): boolean {
  const previousValueRef = useRef(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (Object.is(previousValueRef.current, value)) {
      return;
    }

    previousValueRef.current = value;
    setIsPulsing(true);

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsPulsing(false);
    }, durationMs);
  }, [durationMs, value]);

  return isPulsing;
}
