## MODIFIED Requirements

### Requirement: Node detail inspection
The view SHALL let the user inspect an individual change node to see its key roadmap facts (its phase, status, and the capabilities it adds or modifies), and SHALL additionally present that change's full task list grouped by section, keeping the existing task progress summary. Completed tasks SHALL be visually marked as complete and distinguishable from incomplete tasks. The task list SHALL be read-only — the view SHALL NOT provide any affordance to change task state. When a change has no tasks (no task list attached, e.g. an archived change or one without a `tasks.md`), the detail SHALL omit the task list without error, consistent with how the progress summary is already omitted.

#### Scenario: Inspect a change node
- **WHEN** the user selects a change node
- **THEN** the view shows that change's phase, status, and its new/modified capabilities

#### Scenario: Task list shown grouped by section
- **WHEN** the user inspects a change whose model carries a grouped task list
- **THEN** the detail shows every task under its section heading, preserving the sections' order, in addition to the existing progress summary

#### Scenario: Completed tasks are marked
- **WHEN** a shown task list contains both completed and incomplete tasks
- **THEN** the completed tasks are rendered with a completion treatment (e.g. checked and struck through) that is visually distinct from the incomplete tasks

#### Scenario: Task list is read-only
- **WHEN** the task list is displayed in the detail
- **THEN** the view presents no control that would toggle or edit a task's completion state

#### Scenario: No task list when the change has none
- **WHEN** the user inspects a change that carries no task list (an archived change, or one with no `tasks.md`)
- **THEN** the detail renders without a task list and without error
