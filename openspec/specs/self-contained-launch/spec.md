# self-contained-launch Specification

## Purpose
TBD - created by archiving change self-contained-multi-project. Update Purpose after archive.
## Requirements
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

