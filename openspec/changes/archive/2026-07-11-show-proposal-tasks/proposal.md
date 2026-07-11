## Why

The proposal detail panel shows a task *progress bar* (`3/7 · 43%`) but never the tasks themselves, so a user inspecting a change cannot see what is actually done and what remains without opening `tasks.md` by hand. The individual task text is dropped during derivation — the daemon only reads the CLI's completed/total counts — so the information the panel needs never reaches the browser.

## What Changes

- The derivation reads each open change's `tasks.md` directly (the CLI exposes only counts, not task text) and attaches a **structured, grouped task list** to each change node — sections from the `## N. …` headings, each with its items' text and completion state — alongside the existing `completedTasks`/`totalTasks` counts.
- The task list travels on the existing roadmap model push, so it live-updates for free (no new endpoint).
- The proposal detail view renders the full task list, **grouped by section**, below the existing progress bar (which is kept). Completed tasks are marked as such (check + strikethrough); pending tasks are shown unchecked.
- The list is **read-only** — it displays state parsed from `tasks.md` and never writes back, consistent with DataLoom's mirror-never-launcher stance.
- **Archived** changes are skipped (no task list attached). A change with no `tasks.md` (or zero tasks) degrades gracefully — the list is simply absent, exactly as the progress bar already hides itself today.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `roadmap-derivation`: the derivation additionally reads each non-archived change's `tasks.md` to produce a structured, section-grouped list of task items (text + completion state) attached to the change in the emitted model — the CLI's counts alone do not carry task text.
- `roadmap-view`: node detail inspection additionally renders the change's full task list, grouped by section, with completed tasks visually marked, keeping the existing progress bar; read-only.

## Impact

- `src/openspecClient.ts` — new reader that parses a change's `tasks.md` into grouped sections of `{ text, done }` items (mirrors the existing direct-read pattern used for proposal capabilities).
- `src/types.ts` — `ChangeNode` gains a structured task-list field; a small task-group/task-item type is added to the daemon↔browser contract.
- `src/derive.ts` — populates the new field for non-archived changes; archived nodes leave it empty.
- `public/app.js` — the change detail renderer draws the grouped task list below the progress bar.
- `public/style.css` — styling for the task list (grouping, checkbox/strikethrough for done, wrapping for long task lines, scroll within the panel).
- No new HTTP endpoint, no new dependency; the data rides the existing WebSocket model broadcast.
