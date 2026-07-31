import { err, ok, type AppError, type Result } from '@/core/errors';
import type { Coordinates } from '@/shared/types';

import {
  ALERT_SEVERITIES,
  isAlertActive,
  type SevereAlert,
} from '../entities/weather-condition';
import type { WeatherRepository } from '../repositories/weather-repository';

/**
 * Active severe weather alerts, most urgent first.
 *
 * Two rules live here rather than in the UI:
 *
 * 1. **Expired alerts are dropped.** A warning that ended yesterday is not
 *    information, it is noise — and safety-critical noise trains users to
 *    ignore the banner.
 * 2. **Sorted by severity.** If only one alert fits on screen it must be the
 *    most urgent one.
 */
export class GetSevereAlerts {
  constructor(private readonly repository: WeatherRepository) {}

  async execute(
    coordinates: Coordinates,
    now: Date = new Date(),
  ): Promise<Result<SevereAlert[], AppError>> {
    const alerts = await this.repository.getAlerts(coordinates);
    if (alerts.isErr()) return err(alerts.error);

    const active = alerts.value
      .filter((alert) => isAlertActive(alert, now))
      .sort(
        (a, b) =>
          ALERT_SEVERITIES.indexOf(b.severity) - ALERT_SEVERITIES.indexOf(a.severity),
      );

    return ok(active);
  }
}
