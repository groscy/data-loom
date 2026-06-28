## 1. Install tool (MCP server)

- [x] 1.1 Embed the `/loom:weave` command as a markdown constant in `src/mcpServer.ts` — frontmatter in the repo's style (`name: "Loom: Weave"`, description, category, tags) plus the workflow prompt: list open proposals, find the `pending` ones, propose edges/independence with reasoning, confirm with the user, then apply via `set_dependency` / `mark_independent` and report the re-derived phases
- [x] 1.2 Implement an install handler: resolve `<os.homedir()>/.claude/commands/loom/`, create it if absent, write `weave.md` (overwriting any existing copy), and return `{ path, written, note }` where `note` reminds the user to reload Claude Code
- [x] 1.3 Register `install_weave_skill` in the `ListTools` response (no required arguments) with a description that says it installs the global `/loom:weave` command
- [x] 1.4 Route `install_weave_skill` in the `CallTool` handler
- [x] 1.5 Add a one-line mention to the connect-time `INSTRUCTIONS` that `/loom:weave` can be installed once via `install_weave_skill`

## 2. Docs

- [x] 2.1 README: document `/loom:weave` and the one-time `install_weave_skill` setup in the MCP-server section

## 3. Verification

- [x] 3.1 Drive the server over stdio; confirm `install_weave_skill` appears in `tools/list` and the connect-time instructions mention it
- [x] 3.2 Call `install_weave_skill` (with `os.homedir()` pointed at a scratch dir for isolation); confirm `commands/loom/weave.md` is created, the result returns the path + reload note, and the file holds only the static command (no proposal text, config, or secrets)
- [x] 3.3 Re-call `install_weave_skill`; confirm it overwrites with the current content rather than failing (idempotent to current version)
- [x] 3.4 Confirm the written command is well-formed — valid frontmatter and a body that references `list_open_proposals`, `set_dependency`, and `mark_independent` and requires user confirmation before writing
- [x] 3.5 Perform a real install into the actual `~/.claude/commands/loom/weave.md` (done — invocable after a Claude Code reload)
