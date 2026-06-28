## ADDED Requirements

### Requirement: Surface proposals needing dependency review
The view SHALL indicate which open changes have a `pending` dependency-review state, including an at-a-glance count of how many proposals still need review, so the user knows to ask their agent to review them. The view SHALL only display this state; it SHALL NOT infer or write dependencies.

#### Scenario: Pending proposals are indicated
- **WHEN** the roadmap model includes one or more changes with a `pending` dependency-review state
- **THEN** the view shows how many proposals need dependency review and marks which change nodes they are

#### Scenario: No indicator when all declared
- **WHEN** every open change has a `declared` dependency-review state
- **THEN** the view shows no needs-review indicator
