# guided-setup Specification

## Purpose
TBD - created by archiving change one-command-setup. Update Purpose after archive.
## Requirements
### Requirement: One-command setup verb
The `data-loom` CLI SHALL provide an `up` subcommand that performs the complete always-on setup in one invocation: register login autostart, start the background daemon, and register DataLoom with Claude Code — equivalent to `autostart enable` with its default behavior. `up` SHALL accept an optional project-path argument (passed to the daemon start) and SHALL support the existing `--no-start` and `--no-connect` opt-outs with unchanged meaning.

#### Scenario: Fresh host is fully set up
- **WHEN** the user runs `data-loom up <project-path>` on a host with the openspec CLI available and no prior DataLoom setup
- **THEN** login autostart is registered, the daemon is started against that project, Claude Code registration is attempted, and the command exits successfully

#### Scenario: Opt-outs pass through
- **WHEN** the user runs `data-loom up --no-connect`
- **THEN** autostart is registered and the daemon is started, but no Claude Code registration is attempted

### Requirement: Prerequisite checked before setup
`up` SHALL verify the `openspec` CLI is available before performing any setup step. When it is missing, `up` SHALL print the exact install command, exit with a non-zero code, and leave the system unchanged — no login registration, no daemon start, no client registration.

#### Scenario: Missing openspec aborts cleanly
- **WHEN** the user runs `data-loom up` on a host without the openspec CLI
- **THEN** the command prints the openspec install guidance, exits non-zero, and has performed no setup step

### Requirement: Idempotent re-run with state summary
`up` SHALL be safe to re-run: steps whose outcome is already in place SHALL be reported as such rather than duplicated or failed. On completion `up` SHALL print a summary covering the dashboard URL and daemon state, the autostart state, the Claude Code registration outcome, and a pointer to the `/loom:weave` workflow — so the same command doubles as a setup health check.

#### Scenario: Re-run reports instead of redoing
- **WHEN** the user runs `data-loom up` on a host that is already fully set up
- **THEN** the command succeeds, reports each aspect as already in place, and creates no duplicate registrations

#### Scenario: Summary printed after setup
- **WHEN** `data-loom up` completes its steps
- **THEN** the output includes the dashboard URL, the autostart state, the Claude Code registration outcome, and the `/loom:weave` pointer
