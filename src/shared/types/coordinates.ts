/**
 * A point on Earth.
 *
 * Lives in `shared/types` because BOTH the locations and weather features need
 * it, and CLAUDE.md §7 rule 3 is explicit: shared concepts move DOWN, never
 * sideways. Weather importing this from the locations feature would couple two
 * features that have no real relationship beyond a two-field record.
 *
 * ## Why a type may cross into domain when behaviour may not
 *
 * This file declares a shape and nothing else — no runtime code, no
 * dependencies, nothing to mock. It is architecturally inert, the same argument
 * that lets `core/errors` reach the domain layer.
 *
 * **Behaviour does not get the same exemption.** `distanceKm` and
 * `isValidCoordinates` live in the locations domain, because deciding whether
 * two points are "the same place" is a domain judgement — and Phase 3 already
 * moved one such call out of `shared/utils` for exactly that reason.
 */
export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}
