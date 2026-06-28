## 1. Derivation: dependency-review state

- [x] 1.1 Add `hasDependsOnSection(name)` to `OpenSpecClient` that detects the presence of a `## Depends On` heading, reusing the same heading-regex shape as `dependsOnInSection` (distinct from `readProposalDependsOn`, which reports entries)
- [x] 1.2 Add `dependencyReview: "pending" | "declared"` to the `ChangeNode` type in `src/types.ts`
- [x] 1.3 In `deriveModel`, set `dependencyReview` per open change from `hasDependsOnSection` (`declared` if present, else `pending`); give archived changes a consistent value (`declared`)
- [x] 1.4 Confirm `dependencyReview` is metadata only — phase, dependency edges, and readiness computation are untouched

## 2. MCP server: review surface and tools

- [x] 2.1 Add `dependencyReview` to each entry returned by `list_open_proposals`
- [x] 2.2 Set connect-time `instructions` on the `Server` describing the review workflow: when proposals are `pending`, read them, propose edges (or independence), and confirm with the user before writing
- [x] 2.3 Implement a `mark_independent` handler: validate the change is a known open change, write an empty `## Depends On` section (heading only, no bullet), idempotent when already declared; return `{ change, written, dependencyReview }`
- [x] 2.4 Register `mark_independent` in the `ListTools` response with its input schema and route it in the `CallTool` handler

## 3. Dashboard: needs-review indicator

- [x] 3.1 In `public/app.js`, compute the count of `pending` changes from the model and render an "N proposals need dependency review" indicator
- [x] 3.2 Mark which change cards are `pending`; hide the indicator entirely when every open change is `declared`
- [x] 3.3 Style the indicator and the per-card marker in `public/style.css`

## 4. Verification

- [x] 4.1 Build, run the daemon against `card_rts`, and confirm `list_open_proposals` reports all 5 changes as `pending` and the dashboard shows "5 need review"
- [x] 4.2 Drive the server over stdio (MCP `initialize`) and confirm the connect-time `instructions` are advertised in the handshake result
- [x] 4.3 Call `mark_independent` on one change; confirm an empty `## Depends On` is written, its state flips to `declared`, no edge is added, and the indicator count drops by one
- [x] 4.4 Call `set_dependency` on two changes; confirm the edge forms (phase/readiness change) and both ends report `declared`
- [x] 4.5 Confirm `mark_independent` rejects an unknown change and writes nothing on an already-declared change (idempotent)
- [x] 4.6 Confirm a workspace's phases, edges, and readiness are identical with and without the review state (ordering provably untouched)
