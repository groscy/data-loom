## ADDED Requirements

### Requirement: Serve the weave workflow as an MCP prompt
The server SHALL declare the MCP prompts capability and expose a `weave` prompt whose content is the complete dependency-review workflow (project resolution, pending-review triage, propose, confirm-gate, record, report). The prompt content SHALL be served by the running server so it always matches the running version, and SHALL reference the current CLI guidance for starting and registering DataLoom (`data-loom start`, `data-loom connect claude-code`) rather than superseded invocations. The prompt SHALL preserve the confirm-before-write rule: it SHALL direct the agent to obtain the user's confirmation before any dependency is recorded.

#### Scenario: Prompt listed and served
- **WHEN** an MCP client lists the server's prompts and fetches `weave`
- **THEN** the server returns the current review-workflow content matching the running server version

#### Scenario: Prompt carries the confirm gate
- **WHEN** the `weave` prompt content is fetched
- **THEN** it directs the agent to propose dependencies and obtain user confirmation before calling any write tool

## MODIFIED Requirements

### Requirement: Provision the weave review command
The server SHALL provide a tool that installs a `/loom:weave` slash command into the user's global Claude commands directory, so the dependency-review workflow can be invoked as a single command from any project where the server is registered. The installed command SHALL be a thin, version-stamped alias that directs the agent to fetch and follow the server's `weave` prompt, and SHALL include fallback guidance for when the server's tools are unreachable (start the daemon via `data-loom start`; register via `data-loom connect claude-code`). The tool SHALL create the command's parent directory if absent, SHALL overwrite an existing command file so it installs the current version, and SHALL return the path it wrote together with guidance that Claude Code must be reloaded to pick up the command. The server SHALL surface this setup tool in its connect-time instructions, and SHALL install the command only when explicitly invoked — never automatically on connect. Additionally, on daemon startup, when an alias file already exists at the target path with a version stamp older than the running version (or with no stamp), the daemon SHALL rewrite it to the current alias; the daemon SHALL NOT create the file when it is absent.

#### Scenario: Command installed on request
- **WHEN** the client calls the install tool
- **THEN** the server writes the `/loom:weave` alias into the user's global Claude commands directory and returns the written path plus a reload reminder

#### Scenario: Installed command is a stamped alias
- **WHEN** the install tool writes the command file
- **THEN** the file is a version-stamped alias delegating to the server's `weave` prompt with unreachable-tools fallback guidance, not a copy of the workflow content

#### Scenario: Re-install overwrites with the current version
- **WHEN** the install tool is called and a command file already exists at the target path
- **THEN** the server overwrites it with the current alias rather than failing

#### Scenario: Outdated alias healed on startup
- **WHEN** the daemon starts and the alias file exists with an older or missing version stamp
- **THEN** the daemon rewrites it to the current alias

#### Scenario: Absent alias is not created on startup
- **WHEN** the daemon starts and no alias file exists
- **THEN** the daemon writes nothing to the commands directory

#### Scenario: Never installed automatically on connect
- **WHEN** a client connects to the server
- **THEN** no command file is written unless the client later explicitly calls the install tool
