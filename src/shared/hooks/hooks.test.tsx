import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { useAppState, useOnForeground } from './use-app-state';
import { useDebounce, useDebouncedCallback } from './use-debounce';
import { useHaptics } from './use-haptics';
import { useMotionDuration, useReducedMotion } from './use-reduced-motion';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('tehran', 300));
    expect(result.current).toBe('tehran');
  });

  it('withholds a new value until the delay elapses', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'te' } },
    );

    rerender({ value: 'tehran' });
    expect(result.current).toBe('te');

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('tehran');
  });

  it('restarts the delay on each change, so only the final value is published', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 't' } },
    );

    // This is the behaviour that stops a keystroke becoming a request.
    for (const value of ['te', 'teh', 'tehr', 'tehran']) {
      rerender({ value });
      act(() => {
        jest.advanceTimersByTime(100);
      });
    }
    expect(result.current).toBe('t');

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('tehran');
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('invokes the callback once, with the latest arguments', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 200));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('c');
  });

  it('does not restart the timer when the callback identity changes', () => {
    // An inline arrow at the call site changes identity every render. If that
    // reset the timer, the debounce would never fire.
    const first = jest.fn();
    const second = jest.fn();

    const { result, rerender } = renderHook<
      (...args: readonly unknown[]) => void,
      { cb: jest.Mock }
    >(({ cb }) => useDebouncedCallback(cb, 200), { initialProps: { cb: first } });

    act(() => {
      result.current('x');
    });
    rerender({ cb: second });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(second).toHaveBeenCalledWith('x');
    expect(first).not.toHaveBeenCalled();
  });

  it('cancels a pending call on unmount', () => {
    const callback = jest.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 200));

    act(() => {
      result.current('x');
    });
    unmount();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('useAppState', () => {
  it('releases its subscription on unmount, rather than leaking a listener', () => {
    const remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(() => ({ remove }) as never);

    const { unmount } = renderHook(() => useAppState());
    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('updates when the app state changes', () => {
    let emit: ((status: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      emit = handler as (status: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });

    const { result } = renderHook(() => useAppState());

    act(() => {
      emit?.('background');
    });
    expect(result.current).toBe('background');
  });
});

describe('useOnForeground', () => {
  function mountWithEmitter(callback: () => void) {
    let emit: ((status: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      emit = handler as (status: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });

    const view = renderHook(() => {
      useOnForeground(callback);
    });
    return { emit: (status: AppStateStatus) => emit?.(status), view };
  }

  it('fires on background → active', () => {
    const callback = jest.fn();
    const { emit } = mountWithEmitter(callback);

    act(() => {
      emit('background');
      emit('active');
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires on inactive → active', () => {
    const callback = jest.fn();
    const { emit } = mountWithEmitter(callback);

    act(() => {
      emit('inactive');
      emit('active');
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire on active → inactive', () => {
    const callback = jest.fn();
    const { emit } = mountWithEmitter(callback);

    // iOS reports `inactive` transiently when the control centre is pulled
    // down. Treating that as a foreground event would cause spurious refetches.
    act(() => {
      emit('inactive');
    });

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('useReducedMotion', () => {
  it('starts false, so animation is the default', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('reflects the OS setting once it resolves', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useReducedMotion());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });
});

describe('useMotionDuration', () => {
  it('returns the preferred duration when motion is allowed', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const { result } = renderHook(() => useMotionDuration(250));
    expect(result.current).toBe(250);
  });

  it('collapses to zero when motion is reduced', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useMotionDuration(250));

    await act(async () => {
      await Promise.resolve();
    });

    // The state change still happens — it simply is not animated. Animation
    // must never be the only way information is conveyed (CLAUDE.md §20).
    expect(result.current).toBe(0);
  });
});

describe('useHaptics', () => {
  it('exposes intent-named triggers rather than waveforms', () => {
    const { result } = renderHook(() => useHaptics());

    expect(Object.keys(result.current).sort()).toEqual([
      'error',
      'impact',
      'selection',
      'success',
      'warning',
    ]);
  });

  it('never throws, whatever the platform supports', () => {
    const { result } = renderHook(() => useHaptics());

    expect(() => {
      result.current.selection();
      result.current.success();
      result.current.warning();
      result.current.error();
      result.current.impact();
    }).not.toThrow();
  });

  it('returns a stable identity across renders, so memo boundaries hold', () => {
    const { result, rerender } = renderHook(() => useHaptics());
    const first = result.current;

    rerender({});

    expect(result.current).toBe(first);
  });
});
