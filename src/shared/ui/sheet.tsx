import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo } from 'react';

import { useTheme } from '@/theme';

/**
 * Bottom sheet.
 *
 * Wraps Gorhom so that theming, the backdrop, and accessibility are configured
 * once rather than at each call site — the same reasoning as `GlassSurface`.
 *
 * A sheet is a modal surface, so `accessibilityViewIsModal` is set: without it,
 * a screen reader keeps reading the content behind the sheet, which is both
 * confusing and lets the user activate hidden controls.
 */
export interface SheetProps {
  /** Detents as percentages or points, e.g. `['40%', '85%']`. */
  readonly snapPoints?: readonly (string | number)[];
  readonly onClose?: () => void;
  /** Translated label describing the sheet's purpose. */
  readonly accessibilityLabel: string;
  readonly children: React.ReactNode;
}

export const Sheet = forwardRef<BottomSheet, SheetProps>(function Sheet(
  { snapPoints = ['50%', '90%'], onClose, accessibilityLabel, children },
  ref,
) {
  const theme = useTheme();

  const points = useMemo(() => [...snapPoints], [snapPoints]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        style={[props.style, { backgroundColor: theme.colors.overlay }]}
      />
    ),
    [theme.colors.overlay],
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={points}
      enablePanDownToClose
      // Conditional spread: under `exactOptionalPropertyTypes` an explicit
      // `undefined` is not the same as an absent prop.
      {...(onClose === undefined ? {} : { onClose })}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.borderStrong }}
      accessible={false}
    >
      <BottomSheetView
        accessible
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
        style={{ padding: theme.spacing.base, paddingBottom: theme.spacing.xxl }}
      >
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
});
