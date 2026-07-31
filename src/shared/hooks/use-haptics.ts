import * as ExpoHaptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

/**
 * Haptic feedback.
 *
 * **Haptics are punctuation, not decoration** (CLAUDE.md §20). Bind them to
 * meaningful state changes — a refresh completing, a unit toggling — never to
 * scrolling. Continuous haptics during a gesture are the fastest way to make an
 * app feel cheap and drain a battery.
 *
 * Named by INTENT rather than by waveform, so a call site says what happened
 * rather than which motor pattern to fire.
 */
export interface HapticFeedback {
  /** A control was activated. */
  selection(): void;
  /** An action completed as intended. */
  success(): void;
  /** An action completed with a caveat. */
  warning(): void;
  /** An action failed. */
  error(): void;
  /** A threshold was crossed mid-gesture (pull-to-refresh arming). */
  impact(): void;
}

const noop = (): void => undefined;

export function useHaptics(): HapticFeedback {
  // Android's haptic support through this API is inconsistent across OEMs and
  // frequently feels like a dull buzz rather than a tap. Restricting to iOS is
  // deliberate: no haptic is better than a bad one.
  const enabled = Platform.OS === 'ios';

  const selection = useCallback(() => {
    if (enabled) void ExpoHaptics.selectionAsync();
  }, [enabled]);

  const notify = useCallback(
    (type: ExpoHaptics.NotificationFeedbackType) => () => {
      if (enabled) void ExpoHaptics.notificationAsync(type);
    },
    [enabled],
  );

  const impact = useCallback(() => {
    if (enabled) void ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
  }, [enabled]);

  return useMemo(
    () => ({
      selection,
      success: enabled ? notify(ExpoHaptics.NotificationFeedbackType.Success) : noop,
      warning: enabled ? notify(ExpoHaptics.NotificationFeedbackType.Warning) : noop,
      error: enabled ? notify(ExpoHaptics.NotificationFeedbackType.Error) : noop,
      impact,
    }),
    [enabled, notify, selection, impact],
  );
}
