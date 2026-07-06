## Why

The dashboard already computes exactly when each of the three agent-driven workflows becomes legal — it draws the "N proposals need dependency review" banner (`weave`), the "NEXT UP" / ready flag (`apply`), and the task-progress bar that reaches 100% (`archive`). But acting on any of them means the user leaves the dashboard, switches to Claude Code, and retypes the exact command with the right change name. The dashboard knows the change name; the user shouldn't have to.

DataLoom holds no model and cannot run these workflows itself — `weave`, `apply`, and `archive` require the user's authenticated Claude Code in the loop, often with an explicit confirmation step. And MCP is pull-only: a dashboard click cannot make an already-open session start working. So the honest, in-grain move is a **handoff**: the click prepares the exact command and copies it to the clipboard for the user to paste into Claude Code. The dashboard stays a passive surface; it prepares, the user runs.

## What Changes

- Add **contextual command actions** to the roadmap view, each shown only where DataLoom already proves the precondition:
  - **Weave** — on the existing dependency-review banner (shown when any open change is `pending`). Copies `/loom:weave` (project-wide, no argument).
  - **Apply** — on a change's card and in its detail panel when that change is `ready` and not yet complete. Copies `/opsx:apply <change-name>`.
  - **Archive** — on a change's card and in its detail panel when its tasks are complete (`completedTasks === totalTasks`, `totalTasks > 0`) and it is not archived. Copies `/opsx:archive <change-name>`.
- Each action writes the exact command — change name pre-filled — to the clipboard via `navigator.clipboard.writeText` (available on `localhost`/`127.0.0.1`, which browsers treat as a secure context) and shows a brief **toast** confirming what was copied (e.g. `Copied /opsx:apply add-dark-mode — paste into Claude Code`).
- The actions **only prepare commands**. The dashboard never executes weave, apply, or archive, and the daemon and MCP server are unchanged.

A card click still selects the change and opens its detail, so a card action must stop the click from also triggering selection.

Non-goals (deliberately deferred): launching or spawning a Claude Code session from the dashboard (the "one-click actually runs it" path — rejected here to keep the daemon passive and because it can only ever open a *new* session, never the one the user already has open); any daemon, MCP, type, or derivation change; and an `execCommand('copy')` fallback for pre-secure-context browsers (unnecessary on loopback).

## Capabilities

### New Capabilities

_None._ (Extends the existing roadmap view.)

### Modified Capabilities

- `roadmap-view`: the view gains contextual, clipboard-copy command actions for the weave / apply / archive workflows, each surfaced only where its precondition holds — the weave action on the review banner, and apply / archive on both a change's card and its detail panel — with a confirmation toast. The view only prepares command text; it does not execute the workflows.

## Impact

- **Code**: `public/app.js` (a Weave action on the review banner in `renderReview`; Apply / Archive actions in both `renderCard` and `renderChangeDetail`, with the card action stopping propagation so it does not also select the card; a shared `copyCommand(text)` helper that writes to the clipboard and raises a toast); `public/style.css` (action-button and toast styles). No changes to `src/`, the daemon, the MCP server, or the roadmap model.
- **Constraint** (inherited from the dashboard's "mirror, never launcher" posture): the dashboard remains passive. These actions place command text on the clipboard for the user to run in their own Claude Code session; DataLoom neither runs an agent nor holds a model, so it cannot and does not execute the workflows itself.
- **No new dependencies. No daemon protocol change**: the actions are derived from state the model already carries (`dependencyReview`, `readiness`, `completedTasks` / `totalTasks`, `archived`).
