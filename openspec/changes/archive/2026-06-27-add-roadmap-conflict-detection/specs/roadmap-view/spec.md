## ADDED Requirements

### Requirement: Mark changes involved in a conflict
The view SHALL visually mark every change node that participates in a detected conflict (e.g. a warning treatment), distinct from normal phase/status rendering.

#### Scenario: Conflicted node is marked
- **WHEN** the roadmap model includes a conflict involving a change
- **THEN** the view marks that change's node with a conflict treatment

### Requirement: Show the offending relationship
The view SHALL convey the nature of each conflict — the cycle path or the unsatisfied dependency — so the user can see what to fix, while keeping the rest of the roadmap readable.

#### Scenario: Cycle relationship shown
- **WHEN** a cycle conflict is present
- **THEN** the view shows the relationship between the changes forming the cycle

#### Scenario: Unsatisfied dependency shown
- **WHEN** a dangling-dependency conflict is present
- **THEN** the view indicates the change and the capability that is unsatisfied
