## ADDED Requirements

### Requirement: CI builds the executable on release
The repository SHALL include a GitHub Actions workflow that builds the standalone executable on a Windows runner when a release is triggered by a version tag.

#### Scenario: Version tag triggers a build
- **WHEN** a version tag (e.g. `v1.2.3`) is pushed to the repository
- **THEN** the workflow runs on a Windows runner and builds the standalone executable

### Requirement: Publish the executable as a downloadable release asset
The workflow SHALL attach the built executable to a GitHub Release for that version, so users can download it from the repository's Releases page.

#### Scenario: Executable available on the Release
- **WHEN** the release workflow completes for a version tag
- **THEN** the built executable is available as a downloadable asset on the corresponding GitHub Release

#### Scenario: Build failure publishes nothing
- **WHEN** the build step fails
- **THEN** no release asset is published for that run
