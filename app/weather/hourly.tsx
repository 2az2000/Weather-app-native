import { Redirect, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { HourlyDetailScreen } from '@/features/weather';

/**
 * Hourly detail route.
 *
 * Route params arrive as strings straight from a URL, so they are validated
 * with Zod at this boundary rather than trusted (CLAUDE.md §17) — the screen
 * itself receives typed, already-valid numbers and has no `NaN` branch to
 * consider. A malformed link (hand-typed, or an old deep link whose shape
 * changed) sends the user home instead of crashing on `latitude.toFixed`.
 */
const paramsSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export default function Hourly() {
  const raw = useLocalSearchParams<{ latitude?: string; longitude?: string }>();
  const parsed = paramsSchema.safeParse(raw);

  if (!parsed.success) return <Redirect href="/" />;

  return (
    <HourlyDetailScreen
      latitude={parsed.data.latitude}
      longitude={parsed.data.longitude}
    />
  );
}
