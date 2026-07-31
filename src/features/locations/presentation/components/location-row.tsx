import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconButton, PressableScale, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import { describePlace, type SavedLocation } from '../../domain';

/**
 * One row in the saved list.
 *
 * `React.memo` because this renders inside a FlashList (CLAUDE.md §21) — without
 * it, every row re-renders whenever any row moves.
 *
 * Reordering is exposed as up/down BUTTONS rather than drag-only. A drag gesture
 * is invisible to a screen reader and hard to perform with a motor impairment;
 * buttons make the same operation available to everyone.
 */
export interface LocationRowProps {
  readonly location: SavedLocation;
  readonly onPress: (location: SavedLocation) => void;
  readonly onRemove: (location: SavedLocation) => void;
  readonly onMoveUp: (location: SavedLocation) => void;
  readonly onMoveDown: (location: SavedLocation) => void;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

export const LocationRow = memo(function LocationRow({
  location,
  onPress,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: LocationRowProps) {
  const { t } = useTranslation('locations');
  const theme = useTheme();

  const label = location.isCurrentLocation
    ? t('list.currentLocation')
    : describePlace(location);

  return (
    <PressableScale
      onPress={() => {
        onPress(location);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        // Logical padding, so the row mirrors correctly in Persian.
        paddingStart: theme.spacing.base,
        paddingEnd: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text size="body" weight="medium">
          {location.name === '' ? label : location.name}
        </Text>
        {location.admin1 !== undefined && (
          <Text size="caption" tone="secondary">
            {location.admin1}
          </Text>
        )}
      </View>

      <IconButton
        accessibilityLabel={t('list.moveUp', { name: label })}
        onPress={() => {
          onMoveUp(location);
        }}
        disabled={isFirst}
        size={36}
        icon={<Text tone={isFirst ? 'disabled' : 'accent'}>↑</Text>}
      />
      <IconButton
        accessibilityLabel={t('list.moveDown', { name: label })}
        onPress={() => {
          onMoveDown(location);
        }}
        disabled={isLast}
        size={36}
        icon={<Text tone={isLast ? 'disabled' : 'accent'}>↓</Text>}
      />

      {!location.isCurrentLocation && (
        <IconButton
          accessibilityLabel={t('list.remove', { name: label })}
          onPress={() => {
            onRemove(location);
          }}
          size={36}
          icon={<Text tone="danger">×</Text>}
        />
      )}
    </PressableScale>
  );
});
