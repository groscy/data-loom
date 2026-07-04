## Context

The daemon hosts the MCP endpoint (`/mcp`, loopback HTTP), and clients register that URL directly. If the daemon is down, every tool call fails with an unhelpful transport error. Claude Code registrations cannot start anything themselves for HTTP transports — but they *can* for stdio transports, where the client spawns the configured command per session. That spawn point is the hook this change uses.

## Goals / Non-Goals

**Goals:**
- DataLoom tools work in a fresh Claude Code session even when no daemon is running.
- Exactly one daemon and one source of truth: the shim adds no tools, no sessions, no project logic.
- Failure to launch is loud and instructive, not a hang.

**Non-Goals:**
- Replacing the default HTTP registration (it stays the default; on-demand is opt-in).
- Stopping the daemon when sessions end (idle shutdown is a separate concern; the daemon staying up is desirable).
- Claude Desktop support in this change (its `--bridge` path can adopt the shim later).
- Any change to daemon lifecycle semantics, ports, or security posture.

## Decisions

### 1. Shim = launch check + pure proxy

`data-loom mcp-shim` does two things: (a) if `lifecycle.isRunning()` is false, call `lifecycle.start()` and poll the port (bounded, ~10s); (b) bridge stdio↔HTTP by pairing the MCP SDK's stdio server transport with a streamable-HTTP client transport and forwarding messages both ways. No tool definitions, no handshake interception beyond what forwarding requires.

- *Alternative — reimplement the tools in the shim over shared code:* rejected; two servers drift, and dashboard-selection fallback lives in the daemon.
- *Alternative — depend on `mcp-remote` for the proxying:* rejected; it doesn't do launch-on-demand, and the SDK we already ship covers the transport pairing.

### 2. Launch goes through the existing lifecycle path

The shim calls the same `start()` used by the CLI: detached daemon, single-instance guard, log file, tray. A concurrent race (two sessions spawning shims simultaneously) resolves via the existing port-probe guard — the loser's `start` is a no-op and both shims proxy to the same daemon.

### 3. The daemon outlives the session

When the client session ends, the shim exits; the daemon stays up (it may be serving the dashboard, other sessions, or the tray). On-demand start is a ratchet toward running, never toward stopping — `stop` remains the only deliberate off switch.

### 4. Instructive failure over silence

If the port never answers after a launch attempt, the shim responds to the client's initialize with an MCP error carrying the concrete fix (openspec missing → its install command, read from the daemon log tail when available; otherwise "run `data-loom status`, check the log at <path>"). A hang is the one unacceptable outcome.

### 5. Registration form

`connect claude-code --on-demand` registers `data-loom mcp-shim` as a user-scope stdio server via `claude mcp add` (same no-direct-config-writes rule as today). `disconnect claude-code` removes the `data-loom` entry regardless of which form it is. Switching forms = disconnect + connect; `connect` detects and reports a form mismatch rather than leaving two entries.

## Risks / Trade-offs

- [Registration pins the shim command path (same fragility as autostart's pinning)] → Mitigation: register the `data-loom` PATH shim, not node+script; harden-always-on's stable-launcher work sets the pattern.
- [First tool call in a cold session pays daemon boot latency (~seconds)] → Mitigation: bounded wait with the client's initialize timeout in mind; when a daemon is already up the added latency is negligible.
- [Two registration forms can confuse (which one do I have?)] → Mitigation: `connect` reports the existing form; `data-loom status` gains a line naming the registration form if debugging shows this matters.
- [Session count multiplies shim processes] → Mitigation: shims are near-idle pipes; they exit with their session.

## Open Questions

- Should `up` / `autostart enable` eventually default to `--on-demand` instead of always-on (making the ambient dashboard the opt-in)? Left to the dependency review between this change and `harden-always-on` — the ambient-product argument currently favors always-on as default.
- Do we want the shim to also serve Claude Desktop's `--bridge` mode in this change or a follow-up? Leaning follow-up.
