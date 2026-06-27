## ADDED Requirements

### Requirement: Resilient launch without a project
When launched without a valid project (no project argument and the working directory has no `openspec/` workspace), the application SHALL still start the dashboard rather than exiting. It SHALL use a discovered project if one is available, otherwise start in a no-active-project state presenting the project picker. It SHALL still exit only for the missing `openspec` prerequisite.

#### Scenario: Double-click from a non-project folder
- **WHEN** the executable is launched from a directory that has no `openspec/` workspace and no project argument
- **THEN** the dashboard starts (showing a discovered project or the project picker) instead of exiting

#### Scenario: openspec still required
- **WHEN** the executable is launched on a host without `openspec`
- **THEN** it still exits with install guidance

### Requirement: Open the dashboard on startup
On startup the application SHALL open the default web browser to the dashboard URL, unless suppressed by an environment variable. Failure to open the browser SHALL NOT prevent the dashboard from running.

#### Scenario: Browser opens on launch
- **WHEN** the application starts and browser-opening is not suppressed
- **THEN** it opens the default browser to the dashboard URL

#### Scenario: Suppressed in headless/dev
- **WHEN** the suppression environment variable is set
- **THEN** the application does not open a browser but still serves the dashboard
