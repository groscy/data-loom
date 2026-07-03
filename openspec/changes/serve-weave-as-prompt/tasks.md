## 1. Prompt as source of truth (src/mcpServer.ts)

- [ ] 1.1 Declare the prompts capability and implement `prompts/list` + `prompts/get` for the `weave` prompt, serving the review workflow content
- [ ] 1.2 Rewrite the workflow content with current CLI guidance (`data-loom start`, `data-loom connect claude-code`) replacing the stale `npx` + manual `claude mcp add` instructions, keeping the confirm gate and per-call `project` rules intact
- [ ] 1.3 Replace `WEAVE_COMMAND` with the alias template: front-matter, package-version stamp, delegate-to-prompt instruction, unreachable-tools fallback guidance
- [ ] 1.4 Point `install_weave_skill` at the alias template (same path, same result shape) and update its description and the connect-time instructions tip

## 2. Provisioning and healing

- [ ] 2.1 Extract a shared `provisionWeaveAlias()` (write + stamp) usable by the MCP tool, connect, and the startup refresh
- [ ] 2.2 `src/claudeCode.ts`: `connect` writes the alias best-effort after registration (warn, don't fail); `disconnect` removes the file only when its stamp identifies it as DataLoom's
- [ ] 2.3 `src/index.ts`: on daemon startup, rewrite an existing alias whose stamp is older or missing; never create it when absent

## 3. Verification and docs

- [ ] 3.1 Verify in Claude Code: `/mcp__data-loom__weave` appears with the daemon running; `/loom:weave` alias fetches and follows the prompt end-to-end (list → propose → confirm → write)
- [ ] 3.2 Verify first-install flow: `connect claude-code` → one reload → tools and `/loom:weave` both available
- [ ] 3.3 Verify healing: plant an old-stamp and a stampless `weave.md`, start the daemon, confirm both are rewritten; confirm absence is not created; confirm disconnect's stamp-checked removal
- [ ] 3.4 Verify the prompt appears in Claude Desktop's picker against the running daemon
- [ ] 3.5 Update the README weave section: registration and command arrive together via `connect claude-code`; document the prompt for other MCP clients
