## ADDED Requirements

### Requirement: Strip the corrupted inherited signature before publishing
On a release build, before the executable's checksum is computed and before the executable is published, the workflow SHALL clear the PE certificate-table directory entry of the executable. The SEA blob injection leaves that entry non-empty but pointing at a region that is no longer a valid signature; clearing it makes the published executable cleanly declare no certificate table rather than advertise a corrupted/invalid one.

#### Scenario: Published executable declares no certificate table
- **WHEN** the release workflow completes for a version tag
- **THEN** the published executable's PE certificate-table directory entry is empty (offset 0, size 0), and an Authenticode check reports the file as not signed

#### Scenario: Checksum is computed over the stripped executable
- **WHEN** the release workflow computes the SHA-256 checksum that it publishes alongside the executable
- **THEN** the checksum is computed after the certificate-table directory entry is cleared, so it equals the exact bytes of the published executable

#### Scenario: A failed strip blocks the release
- **WHEN** the executable cannot be made cleanly unsigned — the strip step errors, or the certificate-table directory entry is still non-empty afterward
- **THEN** the workflow fails and no release asset is published for that run
