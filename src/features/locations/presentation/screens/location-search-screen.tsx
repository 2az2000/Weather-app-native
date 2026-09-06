import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDebounce } from '@/shared/hooks';
import { Button, Divider, SkeletonText, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import type { LocationSearchResult } from '../../domain';
import { SearchResultRow } from '../components/search-result-row';
import {
  useCitySearch,
  useRecentSearches,
  useSaveLocation,
} from '../hooks/use-locations';
import { useSelectedLocationStore } from '../stores/selected-location-store';

/** Long enough that a fast typist issues one request, short enough to feel instant. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * City search.
 *
 * Debounced at the INPUT, not in the data layer: the delay belongs to the
 * typing that produces the query, and keeping it here means the hook stays
 * reusable for a non-typed query (a map tap in Phase 8).
 */
export function LocationSearchScreen() {
  const { t, i18n } = useTranslation('locations');
  const theme = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  const search = useCitySearch(debouncedQuery, i18n.language);
  const recent = useRecentSearches();
  const saveLocation = useSaveLocation();
  const selectLocation = useSelectedLocationStore((state) => state.select);

  const results = search.data ?? [];
  const hasQuery = debouncedQuery.trim().length >= 2;

  const handleSelect = (result: LocationSearchResult): void => {
    // AWAITED, not fired-and-forgotten: `mutate` returns immediately with the
    // OPTIMISTIC entry (a temporary `optimistic-<timestamp>` id), and selecting
    // that id would point the home screen at a location that never resolves,
    // because nothing in the saved list ever carries it. `mutateAsync` resolves
    // to the real, persisted `SavedLocation` this screen actually saved.
    //
    // This is also what was MISSING before: saving added the city to the list,
    // but never switched the home screen to show it, so leaving GPS unresolved
    // sent the user right back to the same "no location" screen they searched
    // to get away from.
    saveLocation.mutateAsync(result).then(
      (saved) => {
        selectLocation(saved.id);
        router.back();
      },
      () => {
        // A failed save already rolls its optimistic entry back (CLAUDE.md
        // §24 rule 3) and leaves the list as it was. Staying on this screen
        // lets the user see that and try again, rather than navigating away
        // from a save that did not happen.
      },
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: theme.spacing.base, gap: theme.spacing.md }}>
        <Text size="title3" weight="bold">
          {t('search.title')}
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={t('search.placeholder')}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          style={{
            ...theme.font('regular'),
            fontSize: theme.fontSize.body,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.base,
            minHeight: theme.minTouchTarget,
            // Follows layout direction, so Persian input aligns correctly.
            textAlign: theme.isRTL ? 'right' : 'left',
            writingDirection: theme.isRTL ? 'rtl' : 'ltr',
          }}
        />
      </View>

      {!hasQuery ? (
        <RecentSearches queries={recent.data ?? []} onSelect={setQuery} />
      ) : search.isLoading ? (
        <View style={{ padding: theme.spacing.base }}>
          <SkeletonText lines={5} />
        </View>
      ) : results.length === 0 ? (
        <View style={{ padding: theme.spacing.xl }}>
          <Text size="footnote" tone="secondary" align="center">
            {t('search.noResults', { query: debouncedQuery })}
          </Text>
        </View>
      ) : (
        <FlashList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <Divider inset="base" />}
          renderItem={({ item }) => (
            <SearchResultRow result={item} onPress={handleSelect} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RecentSearches({
  queries,
  onSelect,
}: {
  readonly queries: readonly string[];
  readonly onSelect: (query: string) => void;
}) {
  const { t } = useTranslation('locations');
  const theme = useTheme();

  if (queries.length === 0) {
    return (
      <View style={{ padding: theme.spacing.xl }}>
        <Text size="footnote" tone="tertiary" align="center">
          {t('search.hint')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: theme.spacing.base, gap: theme.spacing.xs }}>
      <Text size="caption" weight="semibold" tone="tertiary">
        {t('search.recent')}
      </Text>

      {queries.map((query) => (
        <Button
          key={query}
          label={query}
          onPress={() => {
            onSelect(query);
          }}
          variant="ghost"
          size="small"
        />
      ))}
    </View>
  );
}
