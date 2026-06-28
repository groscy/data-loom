## ADDED Requirements

### Requirement: Provision the weave review command
The server SHALL provide a tool that installs a `/loom:weave` slash command into the user's global Claude commands directory, so the dependency-review workflow can be invoked as a single command from any project where the server is registered. The tool SHALL create the command's parent directory if absent, SHALL overwrite an existing command file so it installs the current version, and SHALL return the path it wrote together with guidance that Claude Code must be reloaded to pick up the command. The server SHALL surface this setup tool in its connect-time instructions, and SHALL install the command only when explicitly invoked — never automatically on connect.

#### Scenario: Command installed on request
- **WHEN** the client calls the install tool
- **THEN** the server writes the `/loom:weave` command into the user's global Claude commands directory and returns the written path plus a reload reminder

#### Scenario: Re-install overwrites with the current version
- **WHEN** the install tool is called and a command file already exists at the target path
- **THEN** the server overwrites it with the current command content rather than failing

#### Scenario: Never installed automatically on connect
- **WHEN** a client connects to the server
- **THEN** no command file is written unless the client later explicitly calls the install tool

### Requirement: Provisioning writes only a static command file
The install tool SHALL write only a static slash-command definition (the review workflow expressed as a prompt). Even though it writes outside the selected project, it SHALL NOT read, return, or write any proposal content, host configuration, environment, or credential — preserving the server's no-secrets guarantee.

#### Scenario: Only a static command is written
- **WHEN** the install tool runs
- **THEN** the only file it writes is the `/loom:weave` command definition, containing no proposal text, configuration, environment, or credentials

### Requirement: The weave command drives the confirm-gated review
The installed `/loom:weave` command SHALL instruct the agent to list the open proposals, identify those pending dependency review, propose dependency edges or independence with reasoning, obtain the user's confirmation, and only then record them via the server's dependency-writing tools. It SHALL NOT write a dependency the user has not confirmed.

#### Scenario: Weave runs the review workflow
- **WHEN** the user invokes the `/loom:weave` command in a project where the server is registered
- **THEN** the agent lists the open proposals, surfaces the ones pending review, and proposes their dependencies or independence

#### Scenario: Weave confirms before writing
- **WHEN** the agent has proposed dependencies through the weave command
- **THEN** it writes them via `set_dependency` / `mark_independent` only after the user confirms, and writes nothing the user has not confirmed
