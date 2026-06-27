# phase-planning Specification

## Purpose
TBD - created by archiving change add-phase-planning. Update Purpose after archive.
## Requirements
### Requirement: Explicit proposal dependencies
A proposal MAY declare a `## Depends On` list of other change names, and the derivation SHALL treat each declared dependency as a dependency edge in addition to the capability-derived edges. A declared dependency that is archived or done SHALL be treated as satisfied; one that does not resolve to any known change SHALL be recorded as an unsatisfied dependency (surfaced as a conflict).

#### Scenario: Declared dependency adds an edge
- **WHEN** proposal B declares change A under `## Depends On` and A is an active change
- **THEN** the derivation records an edge B depends-on A, and B is placed in a later phase than A

#### Scenario: Declared dependency on archived work is satisfied
- **WHEN** a proposal declares a dependency on a change that is already archived or done
- **THEN** that dependency is treated as satisfied and does not block the proposal

#### Scenario: Unknown declared dependency is surfaced
- **WHEN** a proposal declares a dependency on a name that matches no known change
- **THEN** the derivation records it as an unsatisfied dependency and it appears as a conflict

### Requirement: Readiness classification
The derivation SHALL classify each non-archived proposal as `ready`, `blocked`, or `done`: `done` when it is complete or archived; `ready` when it is not done and every change it depends on (capability-derived or explicit) is done or archived; `blocked` when it is not done and at least one dependency is an active, not-done change.

#### Scenario: Proposal with all dependencies done is ready
- **WHEN** a proposal is not done and all of its dependencies are done or archived
- **THEN** it is classified ready

#### Scenario: Proposal waiting on active work is blocked
- **WHEN** a proposal depends on another active proposal that is not yet done
- **THEN** it is classified blocked

#### Scenario: Readiness is finer than phase
- **WHEN** a later-phase proposal's prerequisites all become done but are not yet archived
- **THEN** the proposal is classified ready rather than remaining blocked

### Requirement: Implementation guidance
The roadmap SHALL visibly distinguish ready from blocked proposals and SHALL surface the recommended next change(s) to implement — the ready proposals, earliest phase first.

#### Scenario: Ready and blocked are distinguishable
- **WHEN** the roadmap renders open proposals with mixed readiness
- **THEN** ready proposals and blocked proposals are visually distinct

#### Scenario: Next-up is highlighted
- **WHEN** one or more proposals are ready
- **THEN** the roadmap highlights the ready proposals in the earliest phase as the recommended next work

