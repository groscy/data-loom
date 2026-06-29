## ADDED Requirements

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

## REMOVED Requirements

### Requirement: CI builds the executable on release
**Reason**: The standalone executable build is removed; the project is distributed via npm.
**Migration**: Install via npm (`npm install -g data-loom`) or run with `npx data-loom`.

### Requirement: Publish the executable as a downloadable release asset
**Reason**: There is no executable to attach; releases publish to the npm registry instead.
**Migration**: Obtain the app from npm rather than the GitHub Releases page.

### Requirement: Publish a checksum alongside the executable
**Reason**: There is no executable to checksum; npm provides package integrity (and provenance) on publish.
**Migration**: npm verifies package integrity on install; no separate checksum file is published.

### Requirement: Strip the corrupted inherited signature before publishing
**Reason**: There is no SEA executable, so there is no inherited Authenticode signature to strip.
**Migration**: None — the corrupted-signature problem only existed for the SEA exe, which is removed.
