## 1. Daemon: parse tasks.md

- [x] 1.1 Add `TaskItem` (`{ text, done }`) and `TaskGroup` (`{ section, items }`) types to `src/types.ts`, and add a `tasks: TaskGroup[]` field to `ChangeNode`
- [x] 1.2 Add a `readTasks(name)` method to `src/openspecClient.ts` that reads `openspec/changes/<name>/tasks.md` and parses it into ordered `TaskGroup`s: `## …` headings become section labels, `- [ ]`/`- [x]` bullets become items (`done` from the `x`, `text` = the bullet remainder with its numeric prefix kept)
- [x] 1.3 Handle the edge cases in `readTasks`: missing/unreadable `tasks.md` → `[]`; bullets before any heading → a single leading untitled group; ignore non-bullet lines so a minimal or malformed file never throws

## 2. Daemon: attach to the model

- [x] 2.1 In `src/derive.ts`, populate `tasks` for each non-archived change by calling `readTasks(name)`; leave `tasks: []` on archived nodes
- [x] 2.2 Confirm the field rides the existing model broadcast (no endpoint or watcher changes needed) — `tasks.md` edits already trigger re-derive + push

## 3. Frontend: render the task list

- [x] 3.1 In `renderChangeDetail` (`public/app.js`), after the existing progress-bar block, render `c.tasks` grouped by section — a section label followed by its items — guarded by `c.tasks?.length` so an empty list renders nothing
- [x] 3.2 Mark each item by state: done → checked marker + strikethrough; pending → empty marker; no interactive/toggle controls (read-only)
- [x] 3.3 Add styles in `public/style.css` for the task list: grouping, done vs. pending treatment, wrapping for long task lines, and scroll within the detail body so long lists don't overflow the panel

## 4. Verification

- [x] 4.1 With a change that has a partially-complete `tasks.md`, open its detail and confirm all tasks appear grouped by section with completed ones marked, alongside the unchanged progress bar
- [x] 4.2 Edit the change's `tasks.md` (check/uncheck an item) and confirm the open panel live-updates via the model push without a manual refresh
- [x] 4.3 Confirm graceful degradation: an archived change and a change with no `tasks.md` show no task list and no error
