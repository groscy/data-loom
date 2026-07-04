## Context

DataLoom is a single-user, local-first Node daemon (`dist/index.js`, launched via the `data-loom` bin) that hosts an HTTP MCP server at `/mcp` on `127.0.0.1:4317`. The `data-loom` CLI already dispatches reserved verbs — `start`/`stop`/`restart`/`status`, `autostart <enable|disable|status>`, and `connect`/`disconnect claude-desktop` (`src/index.ts`). Claude Desktop registration is automated (`src/claudeDesktop.ts`), but Claude Code registration is a manual one-time `claude mcp add --transport http --scope user data-loom http://127.0.0.1:4317/mcp` (documented in README and the MCP server `INSTRUCTIONS`).

The gap (see [proposal.md](./proposal.md)): install + `start`/`autostart enable` bring up the *host* of `/mcp` but never register the endpoint with Claude Code, so the tools never appear in a session. The prior `mcp-autostart-claude-desktop` design explicitly deferred this, "leaving room for a future `connect claude-code`."

Constraints that shape the design: local-first, per-user, no elevation; Windows is the primary target OS; the daemon's serving/derivation core and its loopback-only + Host/Origin security posture must not change; and DataLoom has a standing rule — encoded in the `roadmap-daemon`/`mcp-discovery` specs — that it reads `~/.claude.json` **read-only** and never modifies it.

## Goals / Non-Goals

**Goals:**
- Add `data-loom connect claude-code` / `disconnect claude-code` that register/remove DataLoom's loopback HTTP MCP endpoint with Claude Code at user scope, idempotently and reversibly.
- Register through Claude Code's own configuration mechanism, without DataLoom writing `~/.claude.json` itself.
- Wire the registration into `autostart enable` (best-effort, with a `--no-connect` opt-out) so the always-on path hosts *and* registers in one command.
- Keep the foreground invocation, the daemon core, and the security model unchanged.

**Non-Goals:**
- No direct editing of `~/.claude.json` by DataLoom.
- No change to the MCP tools, the roadmap/derivation core, or the loopback-only security model.
- No cleanup of stale *per-project stdio* `data-loom` registrations from older versions (the README upgrade note already covers that); `connect claude-code` writes only the user-scope HTTP entry.
- No project/local-scope registration — user (global) scope only.

## Decisions

### Register by shelling out to the `claude` CLI, not by editing `~/.claude.json`
`connect claude-code` invokes Claude Code's own CLI:
```
claude mcp add --transport http --scope user data-loom http://127.0.0.1:4317/mcp
```
DataLoom does **not** read-modify-write `~/.claude.json` itself.
- *Why:* that file holds OAuth tokens and per-project history and is written live by any running Claude Code session. DataLoom's standing principle is to treat it read-only; letting the file's one owner (the `claude` CLI) serialize the write avoids clobbering it and keeps DataLoom's hands off the secrets file. This is the key point of departure from `claudeDesktop.ts`, which *does* direct-write — justified there because `claude_desktop_config.json` is a small, MCP-only, DataLoom-owned file, a materially lower-risk target than `~/.claude.json`.
- *Windows:* the `claude` CLI is a `.cmd`/`.ps1` shim, so it must be invoked through a shell — reuse the exact idiom in `openspecClient.ts` (`execFile`/`spawn` with `shell: process.platform === "win32"`).
- *Alternative considered — direct-write `~/.claude.json` (mirror `claudeDesktop.ts`):* rejected. Perfect code symmetry with the Desktop path, and no dependency on `claude` being on PATH, but it breaks the read-only rule and risks racing a live session's write of the mega-file.

### Scope = user (global)
Register at `--scope user`, which lands in `~/.claude.json`'s top-level `mcpServers` — exactly what `mcp/discovery.ts` reads as "global."
- *Why:* matches DataLoom's "one registration serves every project" story; `project` scope would commit an entry into a repo's `.mcp.json`, and `local` scope buries it per-project under `projects[cwd]`.
- *Side effect:* once registered, DataLoom appears as a node in its own MCP Topology tab (discovery picks up the new global entry) — the tool becomes visible in the graph it draws.

### Idempotent upsert via remove-then-add
`claude mcp add` errors when an entry of that name already exists. To mirror the Desktop registrar's unconditional-upsert semantics, `connect` runs `claude mcp remove --scope user data-loom` first (ignoring a "not found" result), then `claude mcp add …`.
- *Why:* deterministic "connect leaves exactly one current entry" regardless of prior state, with no output parsing.

### Graceful degradation when `claude` is absent
If the `claude` CLI is not found (spawn `ENOENT` / non-zero `--version`), `connect claude-code` SHALL NOT fail hard: it prints the manual `claude mcp add --transport http --scope user data-loom http://127.0.0.1:4317/mcp` line and exits so the user can register by hand.
- *Why:* the endpoint host still works; only client registration is unavailable, and the user has an actionable fallback.

### `autostart enable` also connects Claude Code (best-effort, `--no-connect`)
`autostart enable` already starts the daemon immediately (`--no-start` opt-out). It now additionally calls the Claude Code connect step, so enabling always-on does register-at-login + start + client-registration together. The connect step is **best-effort**: if `claude` is missing or errors, `enable` warns and continues — the login item and daemon still succeed. A `--no-connect` flag skips it, paralleling `--no-start`.
- *Why:* directly delivers the "works out of the box after install + autostart" expectation that motivated this work, while keeping the login item / daemon registration robust even when Claude Code isn't installed.
- *Mirror:* best-effort matches how `autostart` already treats `launchctl` on macOS.

### `connect`/`disconnect` naming
Slot `claude-code` alongside `claude-desktop` under the existing `connect`/`disconnect` verbs (`runConnect`/`runDisconnect` branch on the first argument). `disconnect claude-code` runs `claude mcp remove --scope user data-loom` and is idempotent (reports "nothing to remove" when absent).

## Risks / Trade-offs

- **Dependency on `claude` being on PATH** → acceptable: anyone registering *with Claude Code* has Claude Code. Degrades to printed guidance when absent; `autostart enable` treats it best-effort so autostart never fails for lack of `claude`.
- **Exact `claude mcp` flag spelling / scope-file location may drift across Claude Code versions** → verified against the documented `--transport http --scope user` form; if a version changes it, the failure is visible (non-zero exit) and the manual-command fallback still applies.
- **Stale per-project stdio `data-loom` entries from older versions** → out of scope here; the README upgrade note is the reversal, and the user-scope entry this writes does not collide with them.
- **Two registrars now touch MCP config (Desktop direct-write, Code via CLI)** → intentional and documented: the target files differ in risk profile, so the mechanisms differ.

## Migration Plan

- Purely additive; no data migration. Existing users keep the manual `claude mcp add` if they prefer.
- Rollout: ship the verbs and the autostart wiring; update README to present `connect claude-code` and note `autostart enable` now registers Claude Code (with `--no-connect`).
- Rollback: `data-loom disconnect claude-code` removes the entry; `autostart disable` / `stop` unwind the rest. Each is idempotent.

## Resolved Decisions

- **Registration mechanism:** shell out to the `claude` CLI (`claude mcp add`/`remove`), not direct-write of `~/.claude.json`.
- **Autostart wiring:** `autostart enable` also connects Claude Code by default, with a `--no-connect` opt-out.
- **Scope:** user (global).

## Open Questions

- None outstanding.
