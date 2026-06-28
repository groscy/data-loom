## Why

Proposals authored before the data-loom MCP server existed carry no `## Depends On` block, so the deriver finds zero dependency edges and renders every change flat in Phase 1 — confirmed live against `card_rts` (5 changes, 1 phase, 0 edges). Worse, the roadmap cannot tell "flat because nobody reviewed dependencies" apart from "flat because the changes are genuinely parallel." We need a credential-safe way to backfill those missing declarations, where the user's Claude proposes the edges and the user confirms before anything is written.

## What Changes

- Add a **dependency-review state** to every open change: `pending` when its proposal has no `## Depends On` heading, `declared` once that heading exists (even if it lists nothing). This is derived metadata — it does **not** alter the dependency DAG or phase computation.
- The MCP server gains **connect-time instructions** that direct the connecting agent (the user's Claude) to review `pending` proposals, **propose** dependency edges (or independence) to the user, and **wait for confirmation before writing**.
- `list_open_proposals` reports each proposal's review state so the agent knows what still needs review.
- A new **`mark_independent`** MCP tool records "reviewed, depends on nothing" by writing an empty `## Depends On` block — flipping a genuinely-parallel change from `pending` to `declared` without inventing fake edges.
- The dashboard surfaces an **"N proposals need dependency review"** indicator sourced from the new state. The dashboard detects and displays only; it never infers.
- The existing `set_dependency` tool is unchanged.

Non-goals (deliberately deferred): surfacing shared-capability *contention* (e.g. four `card_rts` changes all modifying `presentation-layer`) — a different signal from dependency; any change to phase/edge computation; and dashboard-side approve/reject UI or a staging store for proposed edges.

## Capabilities

### New Capabilities

_None._ (Extends existing roadmap and MCP-server capabilities.)

### Modified Capabilities

- `roadmap-mcp-server`: adds connect-time review instructions, a per-proposal review state on `list_open_proposals`, and a `mark_independent` tool that declares a change has no dependencies.
- `roadmap-derivation`: each change gains a derived `dependencyReview` state (`pending` / `declared`) computed from the presence of a `## Depends On` heading; phase and edge derivation are unchanged.
- `roadmap-view`: the roadmap surfaces which proposals still need dependency review.

## Impact

- **Code**: `src/openspecClient.ts` (detect heading presence, distinct from the empty dependency list); `src/derive.ts` + `src/types.ts` (new `dependencyReview` field on the change node); `src/mcpServer.ts` (server `instructions`, the new field on `list_open_proposals`, the `mark_independent` tool); `public/app.js` + `public/style.css` (review indicator).
- **Constraint** (inherited from `roadmap-mcp-server`): data_loom holds no API credential of its own. Inference comes only from the user's Claude driving the MCP server; the daemon and server detect, nudge, and write what they are told. "Automatic on startup" applies to detection only — never to inference. The confirmation gate is enforced by the agent's behavior via the connect-time instructions, not by the server, which cannot verify that a human approved.
- **No new dependencies. No migration**: the review state is derived from proposal files on every run, never stored.
