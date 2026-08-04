import enCommon from './en/common.json';
import enErrors from './en/errors.json';
import enLocations from './en/locations.json';
import enSettings from './en/settings.json';
import enWeather from './en/weather.json';
import faCommon from './fa/common.json';
import faErrors from './fa/errors.json';
import faLocations from './fa/locations.json';
import faSettings from './fa/settings.json';
import faWeather from './fa/weather.json';

/**
 * Translation resources, namespaced by feature (CLAUDE.md §19 rule 3).
 *
 * Namespaces — not one flat file — so keys stay scoped (`errors:network` rather
 * than a global `network`), and so a feature's strings live and die with it.
 *
 * `errors` mirrors `AppError['kind']` exactly, which is what makes
 * `errorMessageKey()` in `core/errors` a total function: every error variant is
 * guaranteed to have a user-facing translation (CLAUDE.md §22 rule 4).
 */
export const NAMESPACES = [
  'common',
  'errors',
  'settings',
  'locations',
  'weather',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = 'common';

export const resources = {
  en: {
    common: enCommon,
    weather: enWeather,
    errors: enErrors,
    settings: enSettings,
    locations: enLocations,
  },
  fa: {
    common: faCommon,
    weather: faWeather,
    errors: faErrors,
    settings: faSettings,
    locations: faLocations,
  },
} as const;
