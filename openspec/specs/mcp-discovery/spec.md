# mcp-discovery Specification

## Purpose
TBD - created by archiving change add-mcp-topology. Update Purpose after archive.
## Requirements
### Requirement: Merge MCP config sources
The discovery SHALL build the MCP server list by merging Claude Code configuration sources — `~/.claude.json` global `mcpServers`, `~/.claude.json` per-project `mcpServers`, and `~/.claude/.mcp.json` — and SHALL de-duplicate entries that appear under multiple scopes (including OS path variants of the same project).

#### Scenario: Servers merged across sources
- **WHEN** an MCP server is defined in any of the recognized Claude Code config sources
- **THEN** it appears exactly once in the merged server list

#### Scenario: Scope-duplicated entries collapsed
- **WHEN** the same server is present under multiple project scopes or path-variant keys
- **THEN** the discovery collapses them into a single server entry

### Requirement: Preserve and expose server scope
The discovery SHALL retain whether each server is global or project-scoped and, for project-scoped servers, which project they belong to, and SHALL expose this as a property of each server entry.

#### Scenario: Scope retained on each server
- **WHEN** the merged list is produced
- **THEN** each server entry carries its scope (global vs project) and project association where applicable

### Requirement: Transport-agnostic server model
The discovery SHALL represent servers of any transport type (stdio command servers and URL-based http / sse / streamable-http servers) in a single uniform model, recording each server's transport so later availability checking can branch on it.

#### Scenario: Mixed transports represented uniformly
- **WHEN** the config contains both stdio command servers and URL-based servers
- **THEN** all appear in the merged list with their transport type recorded

### Requirement: Project-scope follows the selected project
MCP discovery SHALL determine project-scoped servers from the currently selected project rather than only the daemon's launch directory, so switching projects updates which project-scoped servers appear.

#### Scenario: Project-scoped servers track the selection
- **WHEN** the active project is switched
- **THEN** the project-scoped MCP servers shown are those configured for the newly selected project

#### Scenario: Global servers unaffected by selection
- **WHEN** the active project is switched
- **THEN** global-scoped servers remain present regardless of the selected project

