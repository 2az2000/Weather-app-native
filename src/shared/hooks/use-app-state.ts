import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Track foreground/background transitions.
 *
 * Sync is triggered on app foreground (CLAUDE.md §24 rule 4), so this is the
 * signal that drives revalidation after the app has been away.
 */
export function useAppState(): AppStateStatus {
  const [status, setStatus] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setStatus);
    return () => {
      subscription.remove();
    };
  }, []);

  return status;
}

/**
 * Run a callback when the app returns to the foreground.
 *
 * Fires only on background→active, not on every state change — `inactive` occurs
 * transiently when the iOS control centre is pulled down, and treating that as a
 * foreground event would trigger spurious refetches.
 */
export function useOnForeground(callback: () => void): void {
  const callbackRef = useRef(callback);
  const previousRef = useRef<AppStateStatus | null>(AppState.currentState);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = previousRef.current;
      previousRef.current = next;

      if (isAway(previous) && next === 'active') {
        callbackRef.current();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

/**
 * Whether a state counts as "the user was not looking".
 *
 * Compared by equality rather than by a string method: `AppState.currentState`
 * can be `null` on Android at startup, and calling `.match()` on it throws.
 */
function isAway(status: AppStateStatus | null): boolean {
  return status === 'background' || status === 'inactive';
}
