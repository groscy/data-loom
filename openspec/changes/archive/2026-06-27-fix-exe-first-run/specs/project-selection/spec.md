## ADDED Requirements

### Requirement: Operate with no active project
The dashboard SHALL function with no active project: it SHALL serve, present the project selector populated with discovered candidates, and show an empty roadmap state prompting the user to choose a project. Selecting a candidate SHALL load that project. The project model SHALL represent "no active project" without offering a non-`openspec` directory as the selected project.

#### Scenario: No active project shows the picker
- **WHEN** the dashboard starts with no active project
- **THEN** it shows the project selector with discovered candidates and an empty roadmap prompt, with no project pre-selected

#### Scenario: Selecting from the no-project state loads a project
- **WHEN** the user selects a project while none is active
- **THEN** the dashboard loads that project's roadmap and MCP scope
