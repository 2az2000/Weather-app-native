import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SkeletonText, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import type { SavedLocation } from '../../domain';
import { LocationRow } from '../components/location-row';
import { PermissionPrompt } from '../components/permission-prompt';
import {
  useLocationPermission,
  useRemoveLocation,
  useReorderLocations,
  useSavedLocations,
} from '../hooks/use-locations';

/**
 * The user's saved locations.
 *
 * Screens compose; components render (CLAUDE.md §15 rule 3). This one calls
 * hooks and orchestrates; every row is a presentational component fed by props.
 */
export function LocationListScreen() {
  const { t } = useTranslation('locations');
  const theme = useTheme();
  const router = useRouter();

  const saved = useSavedLocations();
  const permission = useLocationPermission();
  const removeLocation = useRemoveLocation();
  const reorderLocations = useReorderLocations();

  // Memoised: a fresh array each render would change `move`'s dependencies
  // every time, defeating its memoisation.
  const locations = useMemo(() => saved.data ?? [], [saved.data]);

  const move = useCallback(
    (location: SavedLocation, offset: number) => {
      const from = locations.findIndex((item) => item.id === location.id);
      const to = from + offset;
      if (from === -1 || to < 0 || to >= locations.length) return;

      const reordered = [...locations];
      const [moved] = reordered.splice(from, 1);
      if (moved !== undefined) reordered.splice(to, 0, moved);

      reorderLocations.mutate(reordered.map((item) => item.id));
    },
    [locations, reorderLocations],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: theme.spacing.base, gap: theme.spacing.md }}>
        <Text size="title2" weight="bold">
          {t('title')}
        </Text>

        <PermissionPrompt
          status={permission.status}
          isRequesting={permission.isRequesting}
          onRequest={() => {
            void permission.request();
          }}
        />
      </View>

      {saved.isLoading ? (
        <View style={{ padding: theme.spacing.base }}>
          <SkeletonText lines={4} />
        </View>
      ) : locations.length === 0 ? (
        <EmptyState />
      ) : (
        <FlashList
          data={locations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.base }}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          renderItem={({ item, index }) => (
            <LocationRow
              location={item}
              isFirst={index === 0}
              isLast={index === locations.length - 1}
              onPress={() => {
                router.back();
              }}
              onRemove={(location) => {
                removeLocation.mutate(location.id);
              }}
              onMoveUp={(location) => {
                move(location, -1);
              }}
              onMoveDown={(location) => {
                move(location, 1);
              }}
            />
          )}
        />
      )}

      <View style={{ padding: theme.spacing.base }}>
        <Button
          label={t('list.add')}
          onPress={() => {
            router.push('/locations/search');
          }}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

function EmptyState() {
  const { t } = useTranslation('locations');
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.sm,
      }}
    >
      <Text size="callout" weight="medium" align="center">
        {t('list.empty')}
      </Text>
      <Text size="footnote" tone="secondary" align="center">
        {t('list.emptyHint')}
      </Text>
    </View>
  );
}
