## Why

data_loom derives phases from capability edges (a change that *modifies* a capability depends on the change that *adds* it). That works while capabilities are introduced, but it has a blind spot: once a change is archived, its capabilities move into the baseline, so later proposals that build on them show **no** dependency and collapse into Phase 1. In practice that means a set of interdependent **open** proposals can't be planned in a meaningful order, and the roadmap doesn't tell you which one to implement next. This change lets you plan open proposals in phases — declaring intent explicitly where inference can't reach — and turns the roadmap into actionable implementation guidance.

This is additive on settled capabilities, so it is a Phase 1 change.

## What Changes

- **Explicit proposal dependencies**: a proposal may declare a `## Depends On` list of other change names. The derivation treats each as a dependency edge **in addition to** the capability-derived edges, so you can intentionally sequence interdependent open proposals — including ones that only touch baseline capabilities. A declared dependency that is already archived/done is satisfied; an unknown one is surfaced as a conflict (reusing the existing dangling-dependency handling).
- **Readiness classification**: each active proposal is classified **ready / blocked / done** — done when complete or archived; ready when not done and every dependency is done/archived; blocked when it still depends on an active, not-done proposal. Readiness is finer than phase: a later-phase proposal becomes *ready* the moment its prerequisites are done, not only once they're archived.
- **Implementation guidance**: the roadmap visibly distinguishes ready vs blocked proposals and surfaces the recommended **next** change(s) to implement (the ready proposals, earliest phase first).

## Capabilities

### New Capabilities
- `phase-planning`: Plan interdependent open proposals into an implementable order — explicit `Depends On` declarations merged with capability-derived edges, a ready/blocked/done readiness classification per open proposal, and roadmap guidance that highlights what to implement next.

### Modified Capabilities
<!-- None. The new behavior's requirements live in phase-planning; it extends the derivation and view in code without changing their existing requirements. -->

## Impact

- **`src/openspecClient.ts` / `src/derive.ts`**: parse an optional `## Depends On` section from each proposal; merge explicit edges into the dependency graph; compute and emit a `readiness` per change. Explicit edges flow through existing phase and cycle/dangling logic.
- **`public/`**: render readiness (ready/blocked badges, recommended-next highlight) on the roadmap.
- **Workflow**: authors can declare `## Depends On` in proposals to plan sequencing; the roadmap then guides implementation order. No change to roadmap/MCP fundamentals.
