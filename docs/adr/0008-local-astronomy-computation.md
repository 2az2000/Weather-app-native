# ADR-0008 — Compute astronomy on-device rather than fetching it

**Status:** Accepted
**Date:** 2026-07-29

## Context

The application must display sunrise, sunset, moon phase, and moon illumination.

The reflexive approach is to treat these as weather data and fetch them from a weather API. Open-Meteo provides `sunrise` and `sunset` in its daily forecast, but **provides no moon phase data at all** ([ADR-0002](0002-open-meteo-as-primary-provider.md)). That gap forced the question of where astronomical values should actually come from.

The answer is that the question was framed wrongly. **Sun position and moon phase are not weather.** They are deterministic astronomical functions of exactly two inputs — timestamp and coordinates — computed from orbital mechanics that have been known precisely for centuries. Unlike temperature or precipitation, they are not measured, not forecast, not uncertain, and not subject to revision.

Fetching a value that can be computed exactly is a network dependency bought for nothing.

## Decision

**Compute sun position, sunrise, sunset, moon phase, and moon illumination on-device using `suncalc`**, as a **domain service** — `AstronomyCalculator` in `features/weather/domain/services/`.

It lives in `domain/`, not `data/`, because it is pure deterministic logic with **no I/O**. Placing it in the data layer would misrepresent it as something that talks to the outside world.

```
features/weather/domain/services/astronomy-calculator.ts
  ├─ input:  timestamp + coordinates
  ├─ output: sunrise, sunset, solar elevation, moon phase, illumination
  └─ dependencies: suncalc (pure, no side effects)
```

`suncalc` is permitted in the domain layer under the CLAUDE.md §6 exception for pure utility libraries with no side effects — the same exception that allows `dayjs`.

Open-Meteo's `sunrise`/`sunset` fields are still consumed where already present in a forecast response, but the calculator is authoritative and is the sole source for moon data.

## Consequences

**Positive**
- **Works fully offline, with no cache and no staleness.** Astronomy is available for any date at any location, including dates never fetched — the far future, the distant past, a location the user just added while on a plane.
- **Zero network cost**, zero quota consumption, zero latency.
- **Exact rather than approximate.** No interpolation, no provider rounding, no disagreement between providers.
- **Trivially testable** — deterministic input to deterministic output, validated against published astronomical values with the network disabled (a Phase 4 DoD item).
- Enables the dynamic weather background to use **true solar elevation** for golden-hour and blue-hour palettes, rather than a crude "is it after 6pm" heuristic. This is a real UX gain that a fetched sunrise time alone could not provide.
- Closes the moon-phase gap that would otherwise have required a third provider integration.

**Negative**
- A small additional dependency (`suncalc` is ~5 KB, unmaintained-but-stable, and the algorithms it implements do not change).
- Two potential sources for sunrise/sunset — the calculator and the forecast response — which could disagree by a minute or two due to differing atmospheric refraction models. Resolved by treating the calculator as authoritative for display consistency.
- Does not account for local topography: a mountain to the east delays *observed* sunrise beyond the astronomical value. Acceptable — no weather API accounts for this either.

**Rules this creates**
- **Never fetch a value that can be computed exactly.** This principle generalizes beyond astronomy: derived values belong in the domain, not in a network request.
- `AstronomyCalculator` stays pure. If it ever needs I/O, that is a signal the responsibility has been mixed and should be split.
- Astronomy is available before, and independently of, any weather fetch — screens must not gate sun/moon display on forecast loading.

## Alternatives considered

**Fetch from a weather API** — the default assumption, and what the original brief implied. Creates a network dependency for a deterministic value, fails offline for uncached dates, and still would not solve moon phase since Open-Meteo does not provide it.

**Add a dedicated astronomy API** — a third provider, another key, another failure mode, another rate limit, all to obtain values computable locally in microseconds. Clearly worse on every axis.

**Implement the orbital mechanics directly** — removes the dependency, but astronomical algorithms are subtle (equation of time, atmospheric refraction, parallax) and easy to get slightly and invisibly wrong. `suncalc` is a well-tested implementation of the standard algorithms; reimplementing it would be effort spent acquiring bugs.
