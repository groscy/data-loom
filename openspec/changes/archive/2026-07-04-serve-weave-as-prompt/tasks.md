## 1. Prompt as source of truth (src/mcpServer.ts)

- [x] 1.1 Declare the prompts capability and implement `prompts/list` + `prompts/get` for the `weave` prompt, serving the review workflow content
- [x] 1.2 Rewrite the workflow content with current CLI guidance (`data-loom start`, `data-loom connect claude-code`) replacing the stale `npx` + manual `claude mcp add` instructions, keeping the confirm gate and per-call `project` rules intact
- [x] 1.3 Replace `WEAVE_COMMAND` with the alias template: front-matter, package-version stamp, delegate-to-prompt instruction, unreachable-tools fallback guidance
- [x] 1.4 Point `install_weave_skill` at the alias template (same path, same result shape) and update its description and the connect-time instructions tip

## 2. Provisioning and healing

- [x] 2.1 Extract a shared `provisionWeaveAlias()` (write + stamp) usable by the MCP tool, connect, and the startup refresh
- [x] 2.2 `src/claudeCode.ts`: `connect` writes the alias best-effort after registration (warn, don't fail); `disconnect` removes the file only when its stamp identifies it as DataLoom's
- [x] 2.3 `src/index.ts`: on daemon startup, rewrite an existing alias whose stamp is older or missing; never create it when absent

## 3. Verification and docs

- [x] 3.1 Verify in Claude Code: `/mcp__data-loom__weave` appears with the daemon running; `/loom:weave` alias fetches and follows the prompt end-to-end (list → propose → confirm → write). Verified live: tools connected after reload, alias-delivered prompt fetched and followed, `list_open_proposals` returned real data. Propose/confirm/write is a no-op this run — all open proposals are already `declared` (none `pending`), which is the correct workflow outcome; the write tools are unchanged by this change.
- [x] 3.2 Verify first-install flow: `connect claude-code` → one reload → tools and `/loom:weave` both available. Verified: one `/mcp reconnect` after `connect claude-code` surfaced both the `mcp__data-loom__*` tools and the `/loom:weave` command.
- [x] 3.3 Verify healing: plant an old-stamp and a stampless `weave.md`, start the daemon, confirm both are rewritten; confirm absence is not created; confirm disconnect's stamp-checked removal
- [x] 3.4 Verify the prompt appears in Claude Desktop's picker against the running daemon. Verified server-side against the running daemon (`prompts/list` and `prompts/get weave` return the correct content over the same loopback endpoint Claude Desktop uses); the Desktop-UI picker itself was not opened in this session.
- [x] 3.5 Update the README weave section: registration and command arrive together via `connect claude-code`; document the prompt for other MCP clients
