## ADDED Requirements

### Requirement: Publish a checksum alongside the executable
On a release build, the workflow SHALL compute a SHA-256 checksum of the built executable and publish that checksum as a release asset alongside the executable, so a user can verify the integrity of their download against a value recorded in the release.

#### Scenario: Checksum published with the executable
- **WHEN** the release workflow completes for a version tag
- **THEN** a SHA-256 checksum file for the executable is available as a downloadable asset on the corresponding GitHub Release, next to the executable

#### Scenario: Checksum matches the published executable
- **WHEN** a user computes the SHA-256 of the downloaded executable
- **THEN** it equals the value in the published checksum asset for that release
