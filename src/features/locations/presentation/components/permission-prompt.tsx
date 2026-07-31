import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { Button, Card, Text } from '@/shared/ui';
import { useTheme } from '@/theme';

import type { LocationPermissionStatus } from '../hooks/use-locations';

/**
 * Location permission, as designed UX rather than an error.
 *
 * Refusing location access is a legitimate choice, not a failure — the app keeps
 * working and the user can still search for cities (CLAUDE.md §22 rule 6).
 *
 * `denied` and `blocked` are handled DIFFERENTLY, which is the point:
 *
 * - `denied` — the OS will still prompt, so offer the prompt again.
 * - `blocked` — the OS will NOT prompt. Calling `request` does nothing at all,
 *   so offering it would be a button that visibly fails. Send the user to
 *   Settings instead (ROADMAP Phase 3 DoD).
 */
export interface PermissionPromptProps {
  readonly status: LocationPermissionStatus;
  readonly isRequesting: boolean;
  readonly onRequest: () => void;
  readonly onSkip?: () => void;
}

export function PermissionPrompt({
  status,
  isRequesting,
  onRequest,
  onSkip,
}: PermissionPromptProps) {
  const { t } = useTranslation('locations');
  const theme = useTheme();

  if (status === 'granted' || status === 'unknown') return null;

  const isBlocked = status === 'blocked';

  return (
    <Card bordered padding="lg" style={{ gap: theme.spacing.md }}>
      <Text size="callout" weight="semibold">
        {isBlocked ? t('permission.deniedTitle') : t('permission.title')}
      </Text>

      <Text size="footnote" tone="secondary">
        {isBlocked ? t('permission.blockedBody') : t('permission.body')}
      </Text>

      <View style={{ gap: theme.spacing.sm }}>
        {isBlocked ? (
          <Button
            label={t('permission.openSettings')}
            onPress={() => {
              // The only action that can actually change a blocked permission.
              void Linking.openSettings();
            }}
          />
        ) : (
          <Button
            label={t('permission.grant')}
            onPress={onRequest}
            loading={isRequesting}
          />
        )}

        {onSkip !== undefined && (
          <Button label={t('permission.skip')} onPress={onSkip} variant="ghost" />
        )}
      </View>
    </Card>
  );
}
