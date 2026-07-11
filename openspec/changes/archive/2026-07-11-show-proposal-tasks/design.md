## Context

The change detail panel (`renderChangeDetail` in `public/app.js`) already shows a task **progress bar** driven by `completedTasks`/`totalTasks` on each `ChangeNode`. Those counts come from `openspec list --json`; the CLI does not expose the individual task text (`openspec show --json` carries deltas/requirements only). So the panel can summarise progress but cannot list the tasks.

The daemon already establishes the pattern this change follows: because the CLI does not expose capability ownership, `openspecClient.ts` reads `proposal.md` directly (`readProposalCaps`, `readProposalDependsOn`). Reading `tasks.md` directly for the task list is the same move.

The roadmap model is derived wholesale in `derive.ts` and pushed to the browser as one object over the WebSocket (`{type:"model", model}`) — there is no per-change endpoint. Whatever the detail panel needs must either ride that model or be fetched from a new endpoint.

`tasks.md` has a regular shape:

```
## 1. MCP discovery
- [x] 1.1 Add MCP model types (…)
- [ ] 1.2 Read Claude Code config sources
## 5. Verification
- [ ] 5.1 …
```

## Goals / Non-Goals

**Goals:**
- Show the full task list on the proposal detail view, grouped by its `## N. …` sections, with completed tasks visibly marked.
- Keep the existing progress bar as the at-a-glance summary.
- Live-update the list through the mechanism already used for the counts, with no new endpoint.
- Degrade gracefully: archived changes and changes without a `tasks.md` simply show no list.

**Non-Goals:**
- No editing/toggling of task state from the UI (read-only mirror).
- No task lists for archived changes.
- No new HTTP endpoint, dependency, or persisted state.
- No re-parsing of task *counts* or status — those keep coming from the CLI; this change only adds the item text/structure.

## Decisions

### Embed the task list in each `ChangeNode` (vs. a lazy per-change endpoint)
The task list is attached to the node in `derive.ts` and travels on the existing model broadcast, exactly as `completedTasks`/`totalTasks` do today.
- **Why:** consistent with "daemon is the single source of truth; the browser is a thin reactive view" and the wholesale-model-push design. Live updates ride the existing push — when a `tasks.md` changes, the watcher re-derives and re-pushes; a small re-render hook keeps an open detail panel in sync (re-render the selected change's detail on each model push, and skip the slide-in animation when the panel is already visible so it doesn't flicker). This also fixes the pre-existing progress bar, which never live-updated either.
- **Cost:** every node carries its list even though only one panel is open at a time. Task lists are small (a change is ~10–25 short lines); over loopback this is negligible — the model already carries capability lists per node.
- **Alternative rejected:** a `GET /api/change/<name>/tasks` endpoint keeps the model leaner but is not live (must re-fetch on every push while the panel is open), adds an endpoint + client fetch/error paths, and diverges from how task data already flows.

### Parse `tasks.md` in `openspecClient.ts`, shaped in `derive.ts`
A new reader (e.g. `readTasks(name)`) parses the file into ordered sections, each with `{ text, done }` items. `derive.ts` calls it for non-archived changes and sets the new node field; archived nodes leave it empty.
- **Parsing:** section = `## …` heading (kept as its display label); item = a `- [ ]` / `- [x]` bullet, `done` from the `x`, `text` = the remainder (numeric prefix like `1.2` retained as written — it carries meaning and matches how the author sees it). Same tolerant, direct-read style as `capsInSection`.
- Items before any `## ` heading (rare) fall under a single untitled leading group so nothing is dropped.

### Data shape (daemon↔browser contract, `types.ts`)
```ts
interface TaskItem  { text: string; done: boolean }
interface TaskGroup { section: string; items: TaskItem[] }
// ChangeNode gains:
tasks: TaskGroup[]   // [] for archived changes and changes with no tasks.md
```
The counts (`completedTasks`/`totalTasks`) stay as-is; `tasks` is additive, so the progress bar and the status axis are untouched.

### Rendering: list below the kept progress bar, read-only
In `renderChangeDetail`, after the existing progress block, render each group as a section label followed by its items; a done item gets a checked marker + strikethrough, a pending item an empty marker. No interactive controls. Guarded by `c.tasks?.length` so absence renders nothing — mirroring the `c.totalTasks > 0` guard already there.

## Risks / Trade-offs

- **Long task lines** (some tasks run 200+ chars) → the list must wrap and the panel must scroll rather than overflow; handle in `style.css` (wrap long items, constrain/scroll the detail body).
- **Model size grows with task text** → bounded and small over loopback; acceptable given the counts and capability lists already ride the same push. If it ever mattered, the lazy-endpoint alternative remains open.
- **Parser drift if `tasks.md` conventions vary** (e.g. no sections, odd numbering) → tolerant parsing (leading untitled group, ignore non-bullet lines) keeps a malformed or minimal file from breaking derivation; worst case is a flatter-looking list, never a crash.
- **Counts vs. list consistency** → both are derived from the same files on the same pass, so the bar and the list always agree.

## Migration Plan

Additive and backward-compatible: `tasks` defaults to `[]`, so an older browser ignores it and the daemon change is a pure superset. No data migration, no rollback steps beyond reverting the code.

## Open Questions

- None blocking. Numeric task prefixes (`1.2`) are kept verbatim for now; if they read as noise in the panel they can be trimmed at render time later without a model change.
