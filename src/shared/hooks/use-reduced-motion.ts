import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the user has asked the OS to reduce motion.
 *
 * **Animation must never be the only way information is conveyed** (CLAUDE.md
 * §20). When this is true, transitions degrade to instant — the state change
 * still happens, it simply is not animated.
 *
 * Vestibular disorders make large motion genuinely painful for some users. This
 * is an accessibility requirement, not a preference toggle.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduced(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * Pick between an animated duration and an instant one.
 *
 * @example
 * const duration = useMotionDuration(250);   // 0 when motion is reduced
 */
export function useMotionDuration(preferredMs: number): number {
  return useReducedMotion() ? 0 : preferredMs;
}
