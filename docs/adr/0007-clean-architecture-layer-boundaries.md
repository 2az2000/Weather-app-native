# ADR-0007 — Clean Architecture boundaries enforced in CI

**Status:** Accepted
**Date:** 2026-07-29

## Context

This project is built to demonstrate architecture that survives long-term growth. Feature-first Clean Architecture gives the structure: a domain layer that depends on nothing, a data layer that implements domain interfaces, and a presentation layer that consumes use cases.

The structure is only worth anything if it **holds**. Architectural rules maintained by convention and code review decay predictably:

- One deadline-pressured shortcut imports a repository directly into a component.
- A reviewer misses it, or approves it "just this once".
- The next engineer sees the precedent and follows it.
- Within months the layers are nominal — folders named `domain` that import Axios.

The decay is not caused by carelessness. It is caused by the rules being **invisible at the moment of violation**. Nothing tells you that an import is illegal until a human happens to notice.

## Decision

**Encode the architecture as lint rules that fail CI**, established in Phase 0 before any feature code exists.

### The dependency rule

```
presentation  ──►  domain  ◄──  data
                     ▲
                  (imports nothing)
```

### Enforced constraints

| Rule | Rationale |
|---|---|
| `domain/` may not import `react`, `react-native`, `axios`, `expo-*`, `@tanstack/*`, `zustand`, `zod` | Keeps business logic testable in plain Node — the foundation everything else rests on |
| `domain/` may not import from `data/` or `presentation/` | Dependencies point inward |
| `presentation/` may not import from `data/` | Must go through domain interfaces |
| `data/` may not import from `presentation/` | Data has no business knowing about UI |
| No feature may import another feature's internals — only its `index.ts` barrel | Features stay independently changeable |
| `core/` and `shared/` may not import from `features/` | They sit below features in the graph |
| No relative import crossing a feature or layer boundary | Makes violations visible in review, and lintable |

**Enforcement:** `eslint-plugin-boundaries` + `import/no-restricted-paths`, wired into the `lint` CI gate. Additional rules ban `any`, `console.log`, and physical layout properties (see [ADR-0006](0006-rtl-first-layout-strategy.md)).

**Phase 0's Definition of Done includes proving this works:** a deliberately-violating import from `domain/` to `data/` must fail lint. If enforcement is not demonstrated, it does not exist.

## Consequences

**Positive**
- **The architecture cannot silently erode.** A violation is a build failure, not a review opinion.
- Code review shifts from policing imports to discussing design — the rules handle the mechanical part.
- Onboarding is faster: the linter teaches the architecture at the exact moment of the mistake, which is far more effective than a document read once.
- Business logic stays genuinely testable, because it is structurally impossible for it to acquire a React or Axios dependency.
- Refactoring is safer — moving a file that breaks a boundary fails immediately rather than subtly.

**Negative**
- Up-front configuration cost in Phase 0, before any visible product progress.
- The rules will occasionally block something a developer believes is reasonable. **This is intended friction** — the correct response is to discuss and change the rule in a PR, not to add an inline suppression.
- Some indirection is genuinely unnecessary in the small (a use case that only forwards a call). Accepted deliberately: that use case is the seam where caching policy or business rules will land later, and consistency has more value than saving one file.

**Rules this creates**
- **A lint suppression for a boundary rule requires a comment explaining why**, and should be treated as a design smell worth discussing rather than a routine escape hatch.
- **When a rule blocks the right outcome, change the rule in a PR** — never work around it quietly. A rule nobody can justify should be removed, not ignored.
- New layers or features must be registered in the boundary config when created.

## Alternatives considered

**Convention plus code review** — zero setup cost, and the standard approach. Rejected because it depends on every reviewer catching every violation forever. Reviewers are inconsistent by nature, especially under time pressure, and this is exactly the class of error automation handles better than people.

**A separate package per layer (monorepo with enforced package boundaries)** — the strongest possible enforcement, since a package genuinely cannot import what it does not depend on. Rejected as disproportionate: it adds build complexity, workspace tooling, and cross-package type resolution overhead for a single-app project. The lint rules achieve most of the benefit at a small fraction of the cost, and this remains available if the project ever grows into multiple apps.

**Dependency-cruiser** — a capable tool for exactly this, but a second analysis tool to configure and run in CI alongside ESLint. `eslint-plugin-boundaries` keeps enforcement in the linter developers already run on save, so violations surface in the editor rather than in CI.
