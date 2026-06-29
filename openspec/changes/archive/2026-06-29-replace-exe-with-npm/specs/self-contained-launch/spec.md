## MODIFIED Requirements

### Requirement: openspec remains an external prerequisite
data-loom SHALL NOT bundle `openspec`. It SHALL invoke the separately-installed `openspec` CLI, and SHALL NOT start serving a blank dashboard when `openspec` is absent — instead exiting with a clear message that instructs the user to install `openspec`.

#### Scenario: Missing openspec gives install guidance
- **WHEN** data-loom is run on a host without `openspec` available
- **THEN** it exits with a clear message telling the user to install `openspec`, rather than serving an empty dashboard

#### Scenario: Uses the user's installed openspec
- **WHEN** data-loom runs on a host with `openspec` installed
- **THEN** it invokes that installed `openspec` to read the workspace

### Requirement: Accept a target project at launch
data-loom SHALL accept a project path argument selecting the initial project to display, defaulting to the current working directory when none is given.

#### Scenario: Launch against a given project
- **WHEN** data-loom is launched with a project path argument
- **THEN** it displays that project's workspace as the initial active project

#### Scenario: Default to cwd
- **WHEN** data-loom is launched with no project path argument
- **THEN** it displays the current working directory's project

### Requirement: Resilient launch without a project
When launched without a valid project (no project argument and the working directory has no `openspec/` workspace), data-loom SHALL still start the dashboard rather than exiting. It SHALL use a discovered project if one is available, otherwise start in a no-active-project state presenting the project picker. It SHALL still exit only for the missing `openspec` prerequisite.

#### Scenario: Launch from a non-project folder
- **WHEN** data-loom is launched from a directory that has no `openspec/` workspace and no project argument
- **THEN** the dashboard starts (showing a discovered project or the project picker) instead of exiting

#### Scenario: openspec still required
- **WHEN** data-loom is launched on a host without `openspec`
- **THEN** it still exits with install guidance

## REMOVED Requirements

### Requirement: Standalone executable
**Reason**: The standalone executable build is removed; data-loom is distributed via npm, which requires Node.
**Migration**: Install the openspec CLI (`npm install -g openspec`), then run data-loom with `npx data-loom` or after `npm install -g data-loom`.
