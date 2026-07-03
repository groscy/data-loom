## Context

The weave workflow text lives as a build-time constant (`WEAVE_COMMAND` in [mcpServer.ts](../../../src/mcpServer.ts)) and only reaches disk via the `install_weave_skill` tool — an agent-mediated hop with a discovery problem (user must know to ask), a drift problem (installed copies are never refreshed; no version stamp), and a latency problem (a second session reload after install). The MCP protocol's prompts capability and the now-existing `connect claude-code` CLI surface both postdate that design and remove its original rationale ("no separate installer exists").

## Goals / Non-Goals

**Goals:**
- The workflow content has exactly one source of truth: the running server.
- `/loom:weave` (the branded name) is available after first install's single reload, with no conversational step.
- Existing installs heal on upgrade with no user action.
- Claude Desktop users gain a native path to the workflow (prompt picker).

**Non-Goals:**
- Changing the review workflow itself (tools, confirm gate, project resolution rules).
- A Claude Code plugin/marketplace distribution.
- Removing `install_weave_skill` (it stays as the fallback for manual registrations).

## Decisions

### 1. MCP prompt as source of truth, installed file as thin alias (hybrid)

The server exposes a `weave` prompt returning the full review workflow; the installed `/loom:weave` file shrinks to a few lines: front-matter, a version stamp, and an instruction to fetch and follow the data-loom server's `weave` prompt (with the "daemon not running" fallback guidance). Content can then never meaningfully drift — the alias carries no workflow logic.

- *Alternative — prompt only, no installed file:* smallest architecture, but loses the `/loom:weave` name for the auto-generated `/mcp__data-loom__weave`, and loses the ability to give instructive guidance when the daemon is down (no server = no prompt). The alias covers both.
- *Alternative — CLI provisioning of the full text (no prompt):* fixes delivery but not drift; every installed copy still snapshots a version.

### 2. Provisioning rides `connect claude-code`

`connect` writes the alias after registering the MCP endpoint; `disconnect` removes it. Both are best-effort in the same way the registration is (a failure to write the file warns and continues). This means `autostart enable` and the planned `up` verb inherit provisioning for free, and the first-run story becomes: one command → one reload → tools + `/loom:weave` both present.

### 3. Version stamp + startup refresh

The alias carries the package version in an HTML comment. On daemon start, if the alias exists and its stamp is older than the running version, the daemon rewrites it (never creating it uninvited — absence means the user hasn't opted in via connect or the tool). This heals existing installs and keeps the file current without any watcher.

### 4. Alias failure guidance replaces the stale text

The alias's "tools unreachable" branch tells the user to run `data-loom status` / `data-loom start` and register with `data-loom connect claude-code` — replacing the prompt-content's stale `npx @lyric_dev/data-loom "<path>"` + manual `claude mcp add` instructions, which are corrected in the prompt content as part of this change.

## Risks / Trade-offs

- [Prompts capability support varies across MCP clients] → Mitigation: the alias file (and connect-time instructions) still route agents to the same workflow; clients without prompt support lose nothing they have today.
- [The alias adds one indirection (agent must fetch the prompt before acting)] → Mitigation: one `prompts/get` round-trip against a loopback server; negligible.
- [Startup refresh writes into `~/.claude` from the daemon] → Mitigation: same bounded, static-content write the install tool already performs; only refreshes a file that provably exists with our stamp, and the no-secrets guarantee is unchanged.
- [Users with the old full-text `weave.md` (no stamp)] → Mitigation: treat a stampless file at our path as ours-outdated and rewrite it once; the path is namespaced (`commands/loom/weave.md`), so collision risk is nil in practice.

## Open Questions

- Should `disconnect claude-code` remove the alias unconditionally, or only when the stamp identifies it as ours? Leaning stamp-checked removal, symmetrical with the refresh rule.
