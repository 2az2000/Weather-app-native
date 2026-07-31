import { useEffect, useRef, useState } from 'react';

/**
 * Debounce a rapidly-changing value.
 *
 * Used by city search (Phase 3) so a keystroke does not become a request.
 *
 * @param value - The value to debounce.
 * @param delayMs - Quiet period before the value is published.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}

/**
 * Debounce a callback, keeping the latest arguments.
 *
 * The callback is held in a ref so that changing it does not restart the timer —
 * otherwise an inline arrow function at the call site would reset the debounce
 * on every render, defeating it entirely.
 */
export function useDebouncedCallback<Args extends readonly unknown[]>(
  callback: (...args: Args) => void,
  delayMs = 300,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    },
    [],
  );

  return (...args: Args) => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delayMs);
  };
}
