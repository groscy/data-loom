# roadmap-mcp-server Specification

## Purpose
TBD - created by archiving change add-roadmap-mcp-server. Update Purpose after archive.
## Requirements
### Requirement: Daemon-hosted HTTP MCP server
data_loom SHALL expose its MCP tools over an HTTP transport hosted by the long-running dashboard daemon, on the same loopback address and port as the dashboard, so that a single user-scope registration serves every project and multiple concurrent client sessions. The endpoint SHALL bind to loopback only.

#### Scenario: Server lists its tools over HTTP
- **WHEN** an MCP client connects to the daemon's MCP endpoint over HTTP and requests its tools
- **THEN** the server completes the MCP handshake and reports its available tools

#### Scenario: One registration serves multiple projects
- **WHEN** a client uses the single registered HTTP endpoint to operate on two different projects
- **THEN** both are served by the same running daemon without re-registration

#### Scenario: Endpoint is loopback-only
- **WHEN** the daemon starts the MCP endpoint
- **THEN** it is reachable only on the loopback interface, never on an external interface

### Requirement: Resolve the target project per call
The server SHALL determine the target project on each tool call rather than at startup. Each project-scoped tool SHALL accept an optional `project` argument (an absolute path). The server SHALL resolve the project in this order: the explicit `project` argument, then the daemon's current dashboard selection. The server SHALL validate that the resolved path is an OpenSpec workspace before reading or writing, and SHALL reject the call with an instructive error (pointing to the project-listing tool) when no project can be resolved or the path is not a workspace. The server SHALL NOT hold a single project frozen for its lifetime.

#### Scenario: Explicit project argument honored
- **WHEN** a tool is called with an explicit `project` path that is an OpenSpec workspace
- **THEN** the call operates on that project, and the result echoes the resolved absolute path

#### Scenario: Falls back to the dashboard selection
- **WHEN** a tool is called with no `project` argument
- **THEN** the call operates on the daemon's currently selected project

#### Scenario: Concurrent calls target different projects
- **WHEN** two calls in the same session pass different explicit `project` paths
- **THEN** each operates only on its own project with no cross-contamination

#### Scenario: Unresolvable or invalid project rejected
- **WHEN** a tool is called with no resolvable project, or with a `project` path that is not an OpenSpec workspace
- **THEN** the call is rejected with an instructive error and writes nothing

### Requirement: List selectable projects as a tool
The server SHALL provide a read-only tool that returns the selectable projects — the OpenSpec workspaces discoverable from Claude Code's known projects plus the daemon's current selection — so a client can discover and confirm a valid project path before calling a project-scoped tool.

#### Scenario: Projects listed for discovery
- **WHEN** the client calls the list-projects tool
- **THEN** the server returns the discoverable OpenSpec workspaces and the current selection, and modifies no files

### Requirement: Expose open proposals as a tool
The server SHALL provide a tool that, for the resolved target project, returns the open (non-archived) changes with their name, proposal content (Why / What Changes / Capabilities), current derived dependencies, phase, and readiness, and each change's dependency-review state (`pending` when its proposal has no `## Depends On` heading, `declared` when that heading is present). The tool SHALL accept an optional `project` argument and resolve the project per the per-call resolution rule. This tool SHALL be read-only.

#### Scenario: Open proposals returned
- **WHEN** the client calls the list-open-proposals tool for a resolved project
- **THEN** the server returns each open change's name, proposal content, current dependencies/phase/readiness, and its dependency-review state, and modifies no files

#### Scenario: Pending review state surfaced
- **WHEN** an open change's proposal has no `## Depends On` heading
- **THEN** the tool reports that change's dependency-review state as `pending`

### Requirement: Set a dependency as a tool
The server SHALL provide a tool that, given a `from` and a `to` change name, writes an explicit `## Depends On` declaration for `to` into `from`'s proposal within the resolved target project. The tool SHALL accept an optional `project` argument and resolve the project per the per-call resolution rule. It SHALL validate that both are known open changes in that project and that `from` differs from `to`, and SHALL not create a duplicate declaration. It SHALL NOT modify the roadmap model directly — only the proposal file.

#### Scenario: Dependency written as a declaration
- **WHEN** the client calls the set-dependency tool with valid `from` and `to` for a resolved project
- **THEN** a `## Depends On` entry for `to` is written into `from`'s proposal, the result echoes the resolved project path, and the roadmap recomputes deterministically from that file

#### Scenario: Invalid dependency rejected
- **WHEN** the client calls set-dependency with a name that is not a known open change in the resolved project, or with `from` equal to `to`
- **THEN** the tool rejects the call and writes nothing

### Requirement: No secrets exposed
The server's tools SHALL expose and accept only proposal text and change names. They SHALL NOT read, return, or accept `~/.claude.json`, environment variables, MCP server configuration, or any host secret, and the server SHALL hold no API credential of its own.

#### Scenario: Tools carry no secrets
- **WHEN** any tool returns data
- **THEN** it contains only proposal text and change identities — no configuration, environment, or credentials

### Requirement: Guide dependency review on connect
The server SHALL advertise connect-time instructions that direct the connecting agent, when any open proposal's dependency-review state is `pending`, to read those proposals, propose dependency edges (or independence) to the user, and obtain the user's confirmation before writing any declaration. The server SHALL NOT itself infer dependencies and holds no model with which to do so.

#### Scenario: Connect-time instructions advertise the review workflow
- **WHEN** an MCP client completes the handshake with the server
- **THEN** the server's advertised instructions tell the agent to review pending proposals and to confirm with the user before writing any declaration

#### Scenario: Server performs no inference of its own
- **WHEN** one or more proposals are pending review
- **THEN** the server neither computes nor writes any dependency on its own, and a declaration is written only when the agent calls a write tool

### Requirement: Declare a change independent as a tool
The server SHALL provide a tool that, given one open change name, records that the change depends on nothing by writing an empty `## Depends On` declaration into that change's proposal within the resolved target project — moving its dependency-review state from `pending` to `declared` without adding any dependency edge. The tool SHALL accept an optional `project` argument and resolve the project per the per-call resolution rule. It SHALL validate that the change is a known open change in that project, and SHALL be idempotent so that declaring an already-declared change writes nothing new.

#### Scenario: Independence written as an empty declaration
- **WHEN** the client calls the mark-independent tool with a valid open change for a resolved project
- **THEN** an empty `## Depends On` section is written into that change's proposal, its review state becomes `declared`, and no dependency edge is added

#### Scenario: Unknown change rejected
- **WHEN** the client calls mark-independent with a name that is not a known open change in the resolved project
- **THEN** the tool rejects the call and writes nothing

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
The installed `/loom:weave` command SHALL resolve the current session's project and pass it explicitly to the server's tools, list that project's open proposals, identify those pending dependency review, propose dependency edges or independence with reasoning, obtain the user's confirmation, and only then record them via the server's dependency-writing tools. It SHALL NOT write a dependency the user has not confirmed. When the daemon hosting the server is not running (its tools are unavailable or the endpoint is unreachable), the command SHALL tell the user to start DataLoom and register the HTTP MCP server, and SHALL stop rather than surfacing a raw transport error.

#### Scenario: Weave runs the review workflow for the session's project
- **WHEN** the user invokes the `/loom:weave` command in a project, with the daemon running
- **THEN** the agent passes that project explicitly, lists its open proposals, surfaces the ones pending review, and proposes their dependencies or independence

#### Scenario: Weave confirms before writing
- **WHEN** the agent has proposed dependencies through the weave command
- **THEN** it writes them via `set_dependency` / `mark_independent` only after the user confirms, and writes nothing the user has not confirmed

#### Scenario: Weave reports a stopped daemon
- **WHEN** the user invokes `/loom:weave` while the daemon is not running
- **THEN** the command tells the user to start DataLoom and register the HTTP MCP server, and stops without erroring out raw

### Requirement: Bound concurrent MCP sessions
The server SHALL bound the number of concurrent MCP client sessions it retains and SHALL release sessions that have been idle beyond a configured period. It SHALL reject new session initialization once the bound is reached, and SHALL remove an evicted or closed session's retained state so that session churn does not grow memory without limit.

#### Scenario: Session bound enforced
- **WHEN** new MCP sessions are initialized past the configured concurrent-session bound
- **THEN** the server rejects the excess initializations rather than retaining unbounded sessions

#### Scenario: Idle session evicted
- **WHEN** a session has been idle beyond the configured period
- **THEN** the server releases it and removes its retained state

### Requirement: Client errors omit host filesystem detail
For unexpected or internal failures, the error the server returns to the client SHALL be generic and SHALL NOT include absolute host filesystem paths or stack traces; full detail SHALL be retained only in server-side logs. Expected validation errors that reference client-supplied input (such as an unknown change name or a path the caller named) MAY echo that input.

#### Scenario: Internal error returns generic message
- **WHEN** an unexpected internal failure occurs while handling a tool call
- **THEN** the client receives a generic error without absolute host paths or stack detail, and the full detail is recorded server-side
