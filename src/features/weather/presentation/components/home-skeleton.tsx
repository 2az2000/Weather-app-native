import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { GlassSurface, Skeleton } from '@/shared/ui';
import { useTheme } from '@/theme';

/**
 * The home screen's loading state.
 *
 * **A skeleton matching the real layout, never a bare spinner** (CLAUDE.md §15
 * rule 9). Every block here mirrors the dimensions of the component it stands
 * in for, so content arriving causes NO layout shift — which is both a quality
 * signal and a real usability win, since a shifting layout moves whatever the
 * user was about to tap.
 *
 * In practice this is rarely seen: MMKV hydrates the query cache synchronously,
 * so a returning user gets content on the first frame (ADR-0004). It is the
 * first-run and first-location experience.
 */
export function HomeSkeleton() {
  const theme = useTheme();
  const { t } = useTranslation('common');

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('a11y.loadingContent')}
      style={{ padding: theme.spacing.base, gap: theme.spacing.xl }}
    >
      {/* Hero — matches CurrentConditionsHero's stack. */}
      <View
        style={{
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xxl,
        }}
      >
        <Skeleton width={140} height={theme.fontSize.callout} />
        <Skeleton width={180} height={theme.fontSize.hero} radius="md" />
        <Skeleton width={120} height={theme.fontSize.headline} />
      </View>

      {/* Hourly strip — same cell width and gap as HourlyStrip. */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {Array.from({ length: 5 }, (_, index) => (
          <GlassSurface key={index} padding="md" radius="lg" style={{ minWidth: 72 }}>
            <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
              <Skeleton width={32} height={theme.fontSize.footnote} />
              <Skeleton width={40} height={theme.fontSize.callout} />
            </View>
          </GlassSurface>
        ))}
      </View>

      {/* Daily list — seven rows at the same height. */}
      <GlassSurface padding="base" radius="lg">
        <View style={{ gap: theme.spacing.base }}>
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} height={theme.fontSize.body} />
          ))}
        </View>
      </GlassSurface>

      {/* Metric grid — two columns, matching MetricGrid's flexBasis. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {Array.from({ length: 6 }, (_, index) => (
          <GlassSurface
            key={index}
            padding="base"
            radius="lg"
            style={{ flexGrow: 1, flexBasis: '47%' }}
          >
            <View style={{ gap: theme.spacing.xs }}>
              <Skeleton width={64} height={theme.fontSize.footnote} />
              <Skeleton width={80} height={theme.fontSize.title3} />
            </View>
          </GlassSurface>
        ))}
      </View>
    </View>
  );
}
