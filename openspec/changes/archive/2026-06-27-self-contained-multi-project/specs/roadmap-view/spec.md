## ADDED Requirements

### Requirement: Project selector control
The view SHALL present a project selector showing the currently active project and the available candidate projects, and selecting a candidate SHALL switch the displayed project so both the roadmap and the MCP topology reflect the new selection.

#### Scenario: Selector shows current and candidates
- **WHEN** the view loads
- **THEN** it shows the active project and lists the candidate projects

#### Scenario: Selecting a project switches the dashboard
- **WHEN** the user picks a different project from the selector
- **THEN** the dashboard switches to that project and both tabs reflect it
