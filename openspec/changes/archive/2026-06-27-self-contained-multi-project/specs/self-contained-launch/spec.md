## ADDED Requirements

### Requirement: Standalone executable
data_loom SHALL be buildable as a standalone executable that embeds the Node runtime, the application code, and the static web assets, so that an end user can run it without installing Node, running `npm install`, or performing a build.

#### Scenario: Runs without Node or a build
- **WHEN** a user runs the data_loom executable on a host with no Node.js installed and no build performed
- **THEN** the dashboard starts and serves its embedded web assets

### Requirement: openspec remains an external prerequisite
The executable SHALL NOT bundle `openspec`. It SHALL invoke the separately-installed `openspec` CLI, and SHALL NOT start serving a blank dashboard when `openspec` is absent — instead exiting with a clear message that instructs the user to install `openspec`.

#### Scenario: Missing openspec gives install guidance
- **WHEN** the executable is run on a host without `openspec` available
- **THEN** it exits with a clear message telling the user to install `openspec`, rather than serving an empty dashboard

#### Scenario: Uses the user's installed openspec
- **WHEN** the executable runs on a host with `openspec` installed
- **THEN** it invokes that installed `openspec` to read the workspace

### Requirement: Accept a target project at launch
The executable SHALL accept a project path argument selecting the initial project to display, defaulting to the current working directory when none is given.

#### Scenario: Launch against a given project
- **WHEN** the executable is launched with a project path argument
- **THEN** it displays that project's workspace as the initial active project

#### Scenario: Default to cwd
- **WHEN** the executable is launched with no project path argument
- **THEN** it displays the current working directory's project
