## ADDED Requirements

### Requirement: Project-scope follows the selected project
MCP discovery SHALL determine project-scoped servers from the currently selected project rather than only the daemon's launch directory, so switching projects updates which project-scoped servers appear.

#### Scenario: Project-scoped servers track the selection
- **WHEN** the active project is switched
- **THEN** the project-scoped MCP servers shown are those configured for the newly selected project

#### Scenario: Global servers unaffected by selection
- **WHEN** the active project is switched
- **THEN** global-scoped servers remain present regardless of the selected project
