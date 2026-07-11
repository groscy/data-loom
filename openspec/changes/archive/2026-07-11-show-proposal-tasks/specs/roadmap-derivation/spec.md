## ADDED Requirements

### Requirement: Per-change task list attached to the model
For each non-archived change, the derivation SHALL read the change's `tasks.md` directly and attach to that change's node in the emitted model a structured task list: an ordered list of sections (from the `## N. …` task headings) each containing its task items, where every item carries its task text and its completion state. This is separate from, and in addition to, the completed/total task counts already sourced from the CLI — the CLI's JSON exposes only the counts, not the task text. Archived changes SHALL NOT carry a task list. A change whose `tasks.md` is absent or contains no task items SHALL carry an empty task list rather than causing the derivation to fail.

#### Scenario: Task items grouped by section
- **WHEN** a non-archived change's `tasks.md` contains task items under one or more `## N. …` section headings
- **THEN** the change's node in the emitted model carries those items grouped under their sections, in the sections' original order, each item with its text and completion state

#### Scenario: Completion state reflects the checkbox
- **WHEN** a task item is written as a checked checkbox (`- [x]`) versus an unchecked one (`- [ ]`)
- **THEN** the corresponding item in the model is marked complete versus incomplete accordingly

#### Scenario: Archived changes carry no task list
- **WHEN** the derivation emits a node for an archived change
- **THEN** that node carries no task list

#### Scenario: Missing tasks.md does not break derivation
- **WHEN** a non-archived change has no `tasks.md` or it contains no task items
- **THEN** the change's node carries an empty task list and the derivation still emits a complete roadmap model
