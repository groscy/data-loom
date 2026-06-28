## Context

`add-dependency-review` gave the MCP server a confirm-gated review workflow (`list_open_proposals` → propose → `set_dependency` / `mark_independent`) plus connect-time instructions describing it. But invoking it still means hand-writing the orchestration prompt each time. The review runs in the project where the server is registered (e.g. `card_rts`), which is not the data_loom repo — so a project-local command in this repo would be unreachable where it's actually needed.

## Goals / Non-Goals

**Goals:**
- A single `/loom:weave` command that runs the whole review.
- Make it available in every project where the server is registered, via a one-time setup the user triggers by prompting the server.
- Keep the credential-free, confirm-before-write model intact.

**Non-Goals:**
- A distributable Claude Code marketplace plugin.
- Auto-installing on connect.
- Committing the command into data_loom's own `.claude/`.

## Decisions

### 1. The MCP server provisions the command on request
A new `install_weave_skill` tool writes the command file when the user asks. Rationale: it is self-contained (the server already runs wherever the user needs the command), needs no separate installer, and fits the conversational flow — "set up the weave command" → one tool call.
- *Alternative — ship a repo-local `.claude/commands/loom/weave.md`:* rejected; only available inside the data_loom repo, not the consuming project.
- *Alternative — a full marketplace plugin:* deferred; much heavier for a single command.
- *Alternative — a `data-loom install` CLI subcommand:* viable, but provisioning-on-prompt keeps setup inside the same Claude session that uses it.

### 2. Install target is the user-global commands dir
`<os.homedir()>/.claude/commands/loom/weave.md` → `/loom:weave`, mirroring this repo's `.claude/commands/opsx/*.md` → `/opsx:*` (namespace = subdirectory). Global scope is what makes it reachable from any registered project. `os.homedir()` keeps it correct on Windows (`C:\Users\<user>`).

### 3. Writing outside the project is bounded and safe
This is the server's first write outside the selected project. It is constrained to a **static** slash-command markdown file: no proposal content, no host config, no environment, no credential — so the existing no-secrets guarantee holds. It is **only** ever triggered by an explicit tool call (never on connect), and the tool's effect (a known path under the user's Claude config) is fully declared in its result.

### 4. Overwrite-on-install
Re-running the tool overwrites the existing file with the current content, so the command is upgraded in place rather than the tool refusing when present. The write is idempotent to the current version.

### 5. The command content lives in the server as a prompt
The `/loom:weave` body is an embedded markdown string (frontmatter matching the repo's command style + the workflow instructions). It only orchestrates the server's own tools and the confirm gate; the dependency reasoning and the user's approval stay with the user's Claude.

## Risks / Trade-offs

- **Writing into `~/.claude/` is outside the usual project sandbox.** → Mitigation: static command file only, user-initiated, no secrets; the result reports the exact path written.
- **The embedded command can drift from the server's tool names.** → Mitigation: it references the same tool names the server registers; they live in one file and are reviewed together.
- **Claude Code must reload to pick up a newly installed command.** → Mitigation: the tool result states this explicitly.
- **Namespace/path collision in the user's global commands.** → Mitigation: a dedicated `loom/` subdirectory scopes the command.

## Migration Plan

None. No stored state and no data migration — the tool writes a file on demand. Rollout is the next release; users run the install tool once (and reload Claude Code). "Rollback" is deleting the installed command file.

## Open Questions

- Final tool name (`install_weave_skill` vs `setup_weave`) — leaning `install_weave_skill` for clarity.
- Whether to also surface a short success hint in the dashboard; out of scope for now (the MCP result + README cover discovery).
