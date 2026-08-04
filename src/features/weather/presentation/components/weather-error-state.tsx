import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { errorMessageKey, type AppError } from '@/core/errors';
import { Button, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

/**
 * The failure state, shown only when there is nothing cached to show instead.
 *
 * The message comes from `errorMessageKey`, which maps an `AppError.kind` to a
 * translated string — **a raw provider message is never shown**, because it is
 * untranslated and often leaks internals (CLAUDE.md §22 rule 4).
 *
 * The retry affordance is offered only for a RETRYABLE error. Inviting someone
 * to retry a validation failure wastes their time on something that cannot
 * succeed.
 */
export interface WeatherErrorStateProps {
  readonly error: AppError;
  readonly onRetry: () => void;
}

export function WeatherErrorState({ error, onRetry }: WeatherErrorStateProps) {
  const theme = useTheme();
  const { t } = useTranslation(['errors', 'common']);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.base,
      }}
    >
      <Text size="headline" weight="semibold" tone="onWeather" align="center">
        {t('errors:title')}
      </Text>

      <Text size="body" tone="onWeather" align="center" style={{ opacity: 0.85 }}>
        {/* `errorMessageKey` returns a namespaced key, so every AppError kind
            is guaranteed a translated message — a resource-parity test proves
            the errors namespace covers the whole union. */}
        {t(errorMessageKey(error))}
      </Text>

      {error.retryable && (
        <Button
          label={t('common:actions.retry')}
          onPress={onRetry}
          variant="secondary"
          accessibilityLabel={t('common:actions.retry')}
        />
      )}
    </View>
  );
}
