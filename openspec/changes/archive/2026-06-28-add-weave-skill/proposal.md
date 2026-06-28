## Why

Reviewing a project's open proposals for dependencies means hand-writing the same orchestration prompt every time (call `list_open_proposals`, reason, propose, confirm, then `set_dependency` / `mark_independent`). A one-word slash command — `/loom:weave` — should run the whole review. But the review happens wherever the data-loom MCP server is registered (e.g. `card_rts`, not the data_loom repo), so the command has to be available globally. The most self-contained delivery is for the MCP server to **provision the command itself** on request, so the user sets it up once by prompting the server.

## What Changes

- The MCP server gains an **`install_weave_skill`** tool. It writes a `/loom:weave` slash command into the user's **global** Claude commands directory (`<homedir>/.claude/commands/loom/weave.md`), creating the `loom/` folder if needed, overwriting any existing copy so it always installs the current version, and returns the written path plus a "reload Claude Code to pick it up" note.
- The installed **`weave`** command is a prompt that drives the review end to end: call `list_open_proposals`, find the `pending` proposals, read them alongside the others, **propose** dependency edges (or independence) with reasoning, **wait for the user's confirmation**, then apply via `set_dependency` / `mark_independent`, and report the re-derived phases.
- The server's connect-time instructions gain a one-line mention that `/loom:weave` can be installed via `install_weave_skill` (one-time setup).
- README documents `/loom:weave` and the one-time setup.

Non-goals (deliberately deferred): a full distributable Claude Code marketplace plugin; auto-installing the command on connect (it must be user-initiated); and shipping the command file inside data_loom's own `.claude/` (the global install is the delivery mechanism, and dogfooding still works because the command is global).

## Capabilities

### New Capabilities

_None._ (Extends the existing MCP-server capability.)

### Modified Capabilities

- `roadmap-mcp-server`: adds an `install_weave_skill` provisioning tool that writes a global `/loom:weave` command, the embedded review-command content it installs, and a connect-time mention of the setup tool.

## Impact

- **Code**: `src/mcpServer.ts` (register + handle `install_weave_skill`; embed the `weave` command markdown; one line added to the connect-time `INSTRUCTIONS`); `README.md` (document `/loom:weave` + setup).
- **Filesystem scope**: this is the first server action that writes **outside the selected project** — into the user's global `~/.claude/commands/`. It writes a static markdown command file only: no secrets, no credentials, no project data, honoring the server's existing "no secrets / holds no credential" charter. It is only ever triggered by the user explicitly prompting it, never on connect.
- **No new dependencies**; home directory resolved via `os.homedir()` for cross-platform correctness.
