# ADR-0003 — Client-direct API keys with a proxy seam

**Status:** Accepted
**Date:** 2026-07-29

## Context

Some remaining services require API keys: OpenWeather (severe alerts and fallback), Mapbox (map tiles), and Firebase Cloud Messaging (push).

**Any key shipped inside a mobile application is extractable.** Obfuscation, native storage, and encryption-at-rest all delay rather than prevent extraction — the app must decrypt the key to use it, so a determined attacker with the binary and a debugger will recover it. This is a property of client-side software, not a flaw in a particular implementation.

The alternative is a backend-for-frontend (BFF) proxy that holds the keys server-side and exposes only an app-specific endpoint.

The tradeoff was presented to the project owner, who chose **client-direct with a proxy seam**.

## Decision

**Call provider APIs directly from the device**, with keys sourced from EAS Secrets at build time, **but structure the data layer so a proxy can be introduced later by changing one binding.**

Crucially, [ADR-0002](0002-open-meteo-as-primary-provider.md) removed the key requirement from the *primary* data path. Open-Meteo needs no key at all. This materially reduces what is at risk here:

| Key | Exposure if extracted | Mitigation |
|---|---|---|
| **(none — Open-Meteo)** | — | Primary weather data needs no key |
| OpenWeather | Quota theft on a free tier | Low value; restrict by usage alerts; rotatable |
| Mapbox | Tile quota theft, billable | **URL-restrict the public token to the app's bundle IDs** |
| FCM | Client tokens are designed to be public | Sending requires the *server* key, which never ships |

## Consequences

**Positive**
- No backend to build, deploy, secure, monitor, or pay for.
- No additional latency hop between device and provider.
- The app has no single point of failure that we operate.
- Combined with ADR-0002, **the highest-value secret does not exist at all.**

**Negative**
- **The OpenWeather and Mapbox keys are extractable from the bundle.** This is accepted, not solved.
- No shared server-side cache: each device caches independently, so aggregate upstream traffic is higher than it would be behind a proxy.
- Provider quotas are consumed per-device; a popular release consumes quota linearly with installs.
- Key rotation requires an app release (or a remote-config indirection, not currently built).

**Required mitigations** — these are not optional given the above:
1. **Mapbox tokens must be URL-restricted** to the app's bundle identifiers. An unrestricted Mapbox token is a billing incident waiting to happen.
2. Keys live in **EAS Secrets**, never in git. `.env` is gitignored. CI must fail on any committed key.
3. Use **public/scoped tokens** wherever a provider offers them; never ship a token with write or admin scope.
4. Set **billing alerts** on every keyed provider.
5. Keys are accessed only through `core/config/env.ts`, never read inline — so rotation and future indirection touch one file.

## The proxy seam

The seam is preserved by architecture, not by intention. All remote access flows through `RemoteDataSource` classes sitting behind domain repository interfaces:

```
Use case  →  WeatherRepository (interface, domain)
                    ▲
                    │ implements
          WeatherRepositoryImpl (data)
                    │
                    ▼
          RemoteWeatherDataSource  ←── the seam
                    │
                    ▼
          Axios instance (core/api)  ←── baseURL + auth live here
```

**Introducing a BFF later requires:** a new `baseURL`, updated DTO shapes and mappers, and removing key headers from the interceptor. **It requires no change to any domain entity, use case, hook, component, or screen.**

To keep this true:
- Provider-specific concepts must **never** leak above the data layer. A `provider` field on a domain entity, or a component that knows a response came from OpenWeather, breaks the seam.
- Every provider maps into the *same* entities (enforced by the Phase 4 equivalence test).

## Revisit this decision when

- The app is released commercially — Open-Meteo's non-commercial CC-BY licence would already require a paid plan at that point, making a proxy a natural companion change.
- Mapbox or OpenWeather billing shows anomalous usage indicating key abuse.
- A future authentication feature requires server-side session handling regardless.

## Alternatives considered

**BFF proxy from day one** — genuinely secure, enables a shared edge cache, and would let one upstream call serve many users. Rejected for now as a second codebase to build, deploy, and document for a project whose primary provider needs no key anyway. The seam above makes this a cheap decision to reverse.

**Obfuscating keys in native code** — rejected as security theatre. It raises the effort to extract a key from minutes to perhaps an hour, while adding real complexity and creating a false sense of safety. Better to accept the exposure explicitly and restrict the tokens.
