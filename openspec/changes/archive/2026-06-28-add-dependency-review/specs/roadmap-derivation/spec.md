## ADDED Requirements

### Requirement: Derive dependency-review state per change
The derivation SHALL assign each open change a dependency-review state derived from its proposal: `declared` when the proposal contains a `## Depends On` heading (regardless of whether that section lists any dependencies), otherwise `pending`. This state SHALL be metadata only and SHALL NOT affect dependency-edge derivation, phase assignment, or readiness.

#### Scenario: Missing heading yields pending
- **WHEN** an open change's proposal has no `## Depends On` heading
- **THEN** the derivation marks that change's dependency-review state as `pending`

#### Scenario: Present heading yields declared
- **WHEN** an open change's proposal contains a `## Depends On` heading, even with no entries listed
- **THEN** the derivation marks that change's dependency-review state as `declared`

#### Scenario: Review state does not change ordering
- **WHEN** a change's dependency-review state is `pending` or `declared`
- **THEN** its phase, dependency edges, and readiness are identical to what they would be if the review state were not derived
