# app-branding Specification

## Purpose
TBD - created by archiving change brand-dataloom. Update Purpose after archive.
## Requirements
### Requirement: Display name is DataLoom
The application SHALL present its name as "DataLoom" in the UI header and the browser page title.

#### Scenario: Header and title show DataLoom
- **WHEN** the dashboard is loaded in a browser
- **THEN** the header and the page title display "DataLoom"

### Requirement: Single canonical app icon
The application SHALL define one vector app icon asset that serves as the single source for every branded surface.

#### Scenario: One icon source
- **WHEN** any branded surface (favicon, header logo, executable icon) needs the icon
- **THEN** it derives from the same canonical icon asset

### Requirement: Browser favicon and header logo
The application SHALL use the app icon as the browser favicon and SHALL display it as a logo in the UI header beside the name.

#### Scenario: Favicon present
- **WHEN** the dashboard page is loaded
- **THEN** the browser tab shows the app icon as the favicon

#### Scenario: Header logo present
- **WHEN** the dashboard is loaded
- **THEN** the app icon is shown in the header next to the DataLoom name

### Requirement: Branded executable
The packaged Windows executable SHALL be named `DataLoom.exe` and SHALL carry the app icon as its file icon.

#### Scenario: Executable name and icon
- **WHEN** the executable is built
- **THEN** the produced file is named `DataLoom.exe` and has the app icon set as its Windows file icon

