import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { AppError } from '@/core/errors';
import { PermissionPrompt, type LocationPermissionStatus } from '@/features/locations';
import { Button } from '@/shared/ui';
import { useTheme } from '@/theme';

import { HomeSkeleton } from './home-skeleton';
import { WeatherErrorState } from './weather-error-state';

/**
 * What the home screen shows before it has a location.
 *
 * This exists because "no coordinates yet" is THREE different situations that
 * the screen used to collapse into one skeleton:
 *
 * 1. The user refused location access — a decision, not a failure. It needs an
 *    explanation and a way to carry on without GPS.
 * 2. Resolving the position failed for another reason (GPS timeout, geocoder
 *    unavailable) — a real error, and retryable.
 * 3. It is genuinely still resolving — the only case a skeleton describes.
 *
 * Showing a skeleton for the first two is the worst available answer: it claims
 * work is in progress when nothing is running, so the user waits for something
 * that will never arrive. A skeleton must mean something is actually happening.
 */
export interface AwaitingLocationProps {
  readonly permissionStatus: LocationPermissionStatus;
  readonly isRequestingPermission: boolean;
  readonly onRequestPermission: () => void;
  /**
   * Why resolving the position failed, if it did.
   *
   * A permission refusal arrives here too, but the permission branch is checked
   * FIRST — `PermissionPrompt` distinguishes `denied` from `blocked` and offers
   * the right next step, which a generic error screen cannot.
   */
  readonly error: AppError | undefined;
  readonly onRetry: () => void;
}

export function AwaitingLocation({
  permissionStatus,
  isRequestingPermission,
  onRequestPermission,
  error,
  onRetry,
}: AwaitingLocationProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation('locations');

  if (permissionStatus === 'denied' || permissionStatus === 'blocked') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: theme.spacing.base,
          gap: theme.spacing.base,
        }}
      >
        <PermissionPrompt
          status={permissionStatus}
          isRequesting={isRequestingPermission}
          onRequest={onRequestPermission}
        />

        {/* The escape hatch. Declining location is legitimate (CLAUDE.md §22
            rule 6), so it must not end the session — searching a city gives a
            full forecast with no GPS at all. */}
        <Button
          label={t('list.add')}
          variant="secondary"
          onPress={() => {
            router.push('/locations/search');
          }}
        />
      </View>
    );
  }

  if (error !== undefined) {
    return <WeatherErrorState error={error} onRetry={onRetry} />;
  }

  return <HomeSkeleton />;
}
