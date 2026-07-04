## Why

The `/loom:weave` workflow reaches users through an agent-mediated chain — the user must know to ask, `install_weave_skill` writes an unversioned file that upgrades never refresh, and first use costs a second session reload. The design that chose this (add-weave-skill) predates `connect claude-code`; now that a CLI provisioning surface exists, the command's delivery should be deterministic, and its content should never drift from the running server — the shipped text already instructs the superseded `npx` launch and manual `claude mcp add` registration.

## What Changes

- The daemon's MCP server declares the **prompts capability** and serves the weave review workflow as a **`weave` MCP prompt** — the single source of truth, always matching the running server version (clients surface it natively, e.g. Claude Code's `/mcp__data-loom__weave`, Claude Desktop's prompt picker).
- The installed **`/loom:weave` file becomes a thin, version-stamped alias** that directs the agent to fetch and follow the server's `weave` prompt — keeping the branded name while shrinking the drift surface to near zero.
- **`connect claude-code` provisions the alias** (and `disconnect` removes it), so a fresh install gets `/loom:weave` in the same single reload that picks up the MCP registration — no conversational install step, no second reload. `install_weave_skill` remains as the in-conversation fallback and now writes the same alias.
- The **daemon refreshes an outdated alias on startup** (comparing the version stamp), healing existing installs on upgrade.
- The workflow content (now in the prompt) is **updated to current CLI guidance**: `data-loom start` / `connect claude-code` instead of the stale `npx` invocation and manual registration line.

## Capabilities

### New Capabilities

<!-- None — this restructures how the existing weave capability is delivered. -->

### Modified Capabilities

- `roadmap-mcp-server`: adds the prompts capability with the `weave` prompt as the workflow's source of truth; the provisioning requirement changes from "install the full command text" to "install a version-stamped thin alias, refreshed on daemon startup when outdated", with content reflecting current CLI verbs.
- `claude-code-integration`: `connect claude-code` additionally provisions the `/loom:weave` alias and `disconnect claude-code` removes it (best-effort, like the registration itself).

## Impact

- **Code**: `src/mcpServer.ts` (prompts capability + `weave` prompt handler; `WEAVE_COMMAND` replaced by the prompt content + a small alias template; `install_weave_skill` writes the alias), `src/claudeCode.ts` (connect/disconnect provision/remove the alias), `src/index.ts` (startup refresh of a stamped, outdated alias).
- **Users**: existing installed `weave.md` copies are healed automatically on the first daemon start after upgrade.
- **Docs**: README's weave section simplifies — registration and the command arrive together via `connect claude-code`.
- No new dependencies; no change to the tools, the confirm gate, or the no-secrets guarantee.

## Depends On
- add-connect-claude-code
