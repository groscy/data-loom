## Why

The goal is to use Claude to determine the dependencies and order of open proposals — the semantic interdependencies the mechanical rules can't see. Having data_loom *call* Claude hit an authentication wall (the installed desktop Claude's auth isn't available to a spawned subprocess — verified 401), and would mean data_loom handling credentials. **Inverting** the integration solves both at once: data_loom exposes its open proposals and a dependency-writing action as an **MCP server**, and the user's already-authenticated Claude session does the analysis and calls back to apply it. data_loom holds no secrets, the reasoning runs under the user's own installed Claude, and — fittingly — data_loom (which visualizes MCP servers) becomes one.

This is additive on the settled baseline, so it is a Phase 1 change.

## What Changes

- Add an **MCP server mode** to data_loom (a stdio server, launched as `data-loom mcp [project]`) that an MCP client such as Claude Code starts. It exposes two tools:
  - `list_open_proposals` — the open (non-archived) changes with their name, Why / What Changes / Capabilities, and current derived `dependsOn` / phase / readiness. Read-only; **proposal text only** (no config, env, or MCP secrets).
  - `set_dependency` — given `from` and `to` change names, append a `## Depends On` entry for `to` into `from`'s proposal. Validated to known open changes; no duplicates. This is the apply; the running daemon's watcher then re-derives the roadmap deterministically.
- The user asks their Claude session to "analyze data_loom's open proposals and set the dependencies"; Claude calls `list_open_proposals`, reasons about order, and calls `set_dependency` for each. The analysis happens under the user's authenticated Claude — data_loom holds **no credential**.
- Document registering the server in Claude Code.

## Capabilities

### New Capabilities
- `roadmap-mcp-server`: A stdio MCP server exposing the open proposals (read) and a dependency-writing action (`set_dependency`, which writes `## Depends On`), so an MCP client like Claude Code can determine and apply the dependency order. It holds no credentials, exposes only proposal text (no secrets), and applies changes only as explicit `## Depends On` edits that the deterministic derivation then reflects.

### Modified Capabilities
<!-- None. The new behavior is a self-contained MCP server reusing the existing OpenSpec client and phase-planning's Depends On mechanism. -->

## Impact

- **New dependency**: `@modelcontextprotocol/sdk` (official MCP TypeScript SDK).
- **`src/`**: an MCP stdio server entry (`data-loom mcp [project]`) reusing `OpenSpecClient` (read) and a `## Depends On` writer; registers the two tools.
- **No credentials**: data_loom stores and transmits none; tools expose only proposal text and accept only change names. The user's Claude provides its own auth.
- **README**: how to register data_loom as an MCP server in Claude Code.
- **Dogfood**: once registered, data_loom appears as a server in its own MCP topology tab.
