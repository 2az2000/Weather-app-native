import { memo } from 'react';
import { View } from 'react-native';

import { PressableScale, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import { describePlace, type LocationSearchResult } from '../../domain';

/** One city search hit. Memoised — it renders inside a FlashList. */
export interface SearchResultRowProps {
  readonly result: LocationSearchResult;
  readonly onPress: (result: LocationSearchResult) => void;
}

export const SearchResultRow = memo(function SearchResultRow({
  result,
  onPress,
}: SearchResultRowProps) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={() => {
        onPress(result);
      }}
      accessibilityRole="button"
      accessibilityLabel={describePlace(result)}
      style={{
        paddingVertical: theme.spacing.md,
        paddingStart: theme.spacing.base,
        paddingEnd: theme.spacing.base,
      }}
    >
      <View>
        <Text size="body">{result.name}</Text>
        <Text size="caption" tone="secondary">
          {result.admin1 === undefined
            ? result.country
            : `${result.admin1} · ${result.country}`}
        </Text>
      </View>
    </PressableScale>
  );
});
