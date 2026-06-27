## ADDED Requirements

### Requirement: Detect dependency cycles
The derivation SHALL detect cycles in the change dependency DAG and SHALL identify the changes and capabilities participating in each cycle.

#### Scenario: Cycle identified
- **WHEN** change A modifies a capability added by change B and change B modifies a capability added by change A
- **THEN** the derivation reports a cycle naming both changes and the capabilities involved

### Requirement: Detect dangling and out-of-order dependencies
The derivation SHALL detect when a change modifies a capability that no change adds and that has no settled spec baseline (a dangling / out-of-order dependency), and SHALL identify the change and capability involved.

#### Scenario: Dangling dependency identified
- **WHEN** a change modifies capability `X` but no change adds `X` and no baseline spec provides it
- **THEN** the derivation reports an unsatisfied dependency naming that change and `X`

### Requirement: Attach structured conflict information to the model
The derivation SHALL attach structured conflict information (type, involved changes, involved capability) to the emitted roadmap model so the view can surface it, without aborting derivation of the rest of the roadmap.

#### Scenario: Conflicts travel with the model
- **WHEN** one or more conflicts are detected
- **THEN** the emitted roadmap model includes structured conflict entries while still describing all non-conflicting changes
