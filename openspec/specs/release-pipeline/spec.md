# release-pipeline Specification

## Purpose
TBD - created by archiving change self-contained-multi-project. Update Purpose after archive.
## Requirements
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

### Requirement: Publish a checksum alongside the executable
On a release build, the workflow SHALL compute a SHA-256 checksum of the built executable and publish that checksum as a release asset alongside the executable, so a user can verify the integrity of their download against a value recorded in the release.

#### Scenario: Checksum published with the executable
- **WHEN** the release workflow completes for a version tag
- **THEN** a SHA-256 checksum file for the executable is available as a downloadable asset on the corresponding GitHub Release, next to the executable

#### Scenario: Checksum matches the published executable
- **WHEN** a user computes the SHA-256 of the downloaded executable
- **THEN** it equals the value in the published checksum asset for that release

