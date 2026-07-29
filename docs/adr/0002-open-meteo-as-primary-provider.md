# ADR-0002 — Open-Meteo as primary weather provider

**Status:** Accepted
**Date:** 2026-07-29

## Context

The original project brief specified **Tomorrow.io as the primary weather provider**, with OpenWeather as a fallback.

Research into Tomorrow.io's free tier revealed a hard constraint:

> **25 calls/hour, 500 calls/day, 3 requests/second.**

This is not a minor limit. A single user with three saved locations, viewing current conditions, hourly, and daily data, consumes roughly 9 calls per refresh. **Three refreshes exhausts the hourly quota** — for one user, on one device. The app would spend most of its life rate-limited.

Additionally, Tomorrow.io requires an API key, which in a client-only mobile app is extractable from the application bundle by anyone who cares to look. A leaked key against a 500/day quota is trivially deniable-of-service.

The brief author was consulted and authorized switching providers if a materially better option existed.

## Decision

Use **Open-Meteo as the primary provider**, with **OpenWeather retained as a fallback and as the sole source of severe weather alerts.**

### Comparison

| | Tomorrow.io | **Open-Meteo** |
|---|---|---|
| Hourly quota | 25 | **5,000** |
| Daily quota | 500 | **10,000** |
| Per-minute | 3/sec | 600/min |
| API key | Required, extractable | **None required at all** |
| Historical data | Paid add-on | **Free, back to 1940** |
| Air quality | Separate product | Free — exactly the 7 pollutants required |
| Geocoding | Separate | Free |
| 15-minute forecast | Yes | Yes (HRRR / ICON-D2 / AROME regions) |

### Coverage verification

Open-Meteo provides every metric in the brief: `apparent_temperature`, `relative_humidity_2m`, `surface_pressure`, `pressure_msl`, `visibility`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `dew_point_2m`, `uv_index`, `precipitation_probability`, `cloud_cover`, `sunrise`, `sunset`, plus `minutely_15` and a 16-day daily forecast.

**Two gaps, each with a better solution than any weather API:**

| Gap | Solution |
|---|---|
| Severe weather alerts | OpenWeather One Call 3.0 — the only remaining keyed weather source |
| Moon phase | **Computed on-device** — see [ADR-0008](0008-local-astronomy-computation.md) |

### Final provider map

| Concern | Source | Key |
|---|---|---|
| Forecast, historical, air quality, geocoding | Open-Meteo | none |
| Severe weather alerts + resilience fallback | OpenWeather One Call 3.0 | yes |
| Rain radar tiles | RainViewer | none |
| Map tiles | Mapbox | yes |
| Reverse geocoding | `expo-location` → Mapbox fallback | none / yes |
| Sun & moon | `suncalc`, on-device | none |

## Consequences

**Positive**
- **200× the hourly quota.** Rate limiting stops being an architectural problem.
- **No API key on the primary data path**, so the most valuable secret in the app simply does not exist.
- Historical weather becomes genuinely feasible — it was a paid feature under Tomorrow.io.
- Air quality arrives from the same provider with exactly the required pollutant set, so one integration serves two features.

**Negative**
- **Open-Meteo offers no uptime SLA on the free tier.** This is the reason the multi-provider abstraction and circuit breaker are retained — their justification shifts from *quota relief* to *resilience*.
- Severe alerts still require a keyed provider, so key handling does not disappear entirely (see [ADR-0003](0003-client-direct-api-keys-with-proxy-seam.md)).
- 15-minute resolution is only genuinely native in North America and Central Europe; elsewhere it is interpolated from hourly data. The UI must not imply precision that is not there.

**Obligations this creates**
- ⚠️ **Open-Meteo's free tier is CC-BY 4.0 and non-commercial.** Attribution is a **licence requirement, not a courtesy**. The Settings screen must credit Open-Meteo with a link, and this is a Definition-of-Done item in Phase 11.
- Commercial release would require an Open-Meteo commercial subscription. This is recorded here so the obligation is not discovered late.

**Architectural note**
The multi-provider design from the original brief is unchanged. Both providers map into *identical domain entities* via separate mappers, so they remain interchangeable — Phase 4's DoD includes a test proving equivalence.

## Alternatives considered

**Keep Tomorrow.io as specified** — would have made aggressive caching a survival mechanism rather than a UX feature, and would have rate-limited real usage. The brief's intent was a great weather app, not fidelity to a particular vendor.

**WeatherAPI.com** (1M calls/month free) — generous, but requires a key, has less historical depth, and does not bundle air quality with the same pollutant coverage.

**Met Norway / Yr.no** — free and keyless with excellent data, but narrower variable coverage and a strict identifying `User-Agent` requirement; a reasonable third fallback later.

**Self-hosting Open-Meteo** (it is open source) — solves the SLA concern entirely, but adds infrastructure this project does not need. Worth revisiting only if free-tier reliability proves inadequate in practice.
