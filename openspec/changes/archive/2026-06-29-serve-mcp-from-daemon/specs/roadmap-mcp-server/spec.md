## REMOVED Requirements

### Requirement: Stdio MCP server
**Reason**: Replaced by a daemon-hosted Streamable-HTTP MCP server so one running process serves all projects. A stdio process is spawned per session and frozen to one project, which cannot satisfy single-registration, multi-project use. The `data-loom mcp <project>` stdio entry point is removed in this change — there is no backward-compatibility window.

## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Declare a change independent as a tool
The server SHALL provide a tool that, given one open change name, records that the change depends on nothing by writing an empty `## Depends On` declaration into that change's proposal within the resolved target project — moving its dependency-review state from `pending` to `declared` without adding any dependency edge. The tool SHALL accept an optional `project` argument and resolve the project per the per-call resolution rule. It SHALL validate that the change is a known open change in that project, and SHALL be idempotent so that declaring an already-declared change writes nothing new.

#### Scenario: Independence written as an empty declaration
- **WHEN** the client calls the mark-independent tool with a valid open change for a resolved project
- **THEN** an empty `## Depends On` section is written into that change's proposal, its review state becomes `declared`, and no dependency edge is added

#### Scenario: Unknown change rejected
- **WHEN** the client calls mark-independent with a name that is not a known open change in the resolved project
- **THEN** the tool rejects the call and writes nothing

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
