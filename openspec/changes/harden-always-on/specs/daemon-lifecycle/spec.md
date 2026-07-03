## ADDED Requirements

### Requirement: Update command
The `data-loom` CLI SHALL provide an `update` subcommand that upgrades the installed package to the latest published version, restarts the background daemon when one is running, and rewrites the autostart registration (including the stable launcher) when autostart is enabled — so one command leaves the user on the new version with a healthy always-on setup. Each step SHALL be reported. If the package upgrade fails, no restart or registration rewrite SHALL be attempted. When DataLoom is not installed as a global package (for example it was invoked via `npx`), the command SHALL NOT guess an upgrade mechanism; it SHALL print the appropriate manual command instead.

#### Scenario: Update upgrades, restarts, and re-registers
- **WHEN** the user runs `data-loom update` with a daemon running and autostart enabled
- **THEN** the package is upgraded, the daemon is restarted on the new version, and the autostart registration is rewritten, with each step reported

#### Scenario: Update with nothing running
- **WHEN** the user runs `data-loom update` while no daemon is running and autostart is not enabled
- **THEN** the package is upgraded and the command reports that no restart or re-registration was needed

#### Scenario: Failed upgrade aborts the rest
- **WHEN** the package upgrade step fails
- **THEN** the command reports the failure and performs no restart and no registration rewrite

#### Scenario: Non-global install is not guessed at
- **WHEN** the user runs `data-loom update` and the running command is not a global npm installation
- **THEN** the command prints the manual upgrade guidance instead of attempting an upgrade
