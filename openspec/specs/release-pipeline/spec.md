# release-pipeline Specification

## Purpose
TBD - created by archiving change self-contained-multi-project. Update Purpose after archive.
## Requirements
### Requirement: Publish the package to npm on release
The repository SHALL include a GitHub Actions workflow that, when a release is triggered by a version tag, builds the package and publishes it to the npm registry, so users can install and run it with npm/npx.

#### Scenario: Version tag triggers an npm publish
- **WHEN** a version tag (e.g. `v1.2.3`) is pushed to the repository
- **THEN** the workflow builds the package and publishes it to the npm registry under that version

#### Scenario: Build failure publishes nothing
- **WHEN** the build step fails
- **THEN** the workflow does not publish anything to npm for that run

#### Scenario: Installable and runnable from npm
- **WHEN** a user runs `npx data-loom` (or installs it globally and runs `data-loom`) after a successful publish
- **THEN** the dashboard starts, without the user downloading any standalone executable

