## MODIFIED Requirements

### Requirement: Single canonical app icon
The application SHALL define one vector app icon asset that serves as the single source for every branded surface.

#### Scenario: One icon source
- **WHEN** any branded surface (favicon, header logo) needs the icon
- **THEN** it derives from the same canonical icon asset

## REMOVED Requirements

### Requirement: Branded executable
**Reason**: The Windows executable is removed in favor of npm distribution, so there is no exe to name or icon.
**Migration**: None — branding remains via the browser favicon and the in-app header logo.
