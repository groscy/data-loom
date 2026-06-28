## Context

The roadmap derives dependency edges from two signals in each proposal: capability ownership (a Modified capability pointing at whoever Added it) and an explicit `## Depends On` block. Proposals authored before the MCP server shipped have neither the block nor — in practice — overlapping capabilities, so they derive zero edges and render flat. Verified live against `card_rts`: 5 open changes, all Phase 1, every `dependsOn` empty.

The deeper gap is that the model cannot distinguish *unreviewed* from *genuinely independent*. `readProposalDependsOn` returns `[]` both when a proposal has no `## Depends On` section and when it has an empty one. We want to make "has this change been reviewed for dependencies?" a first-class, derived fact, and give the user's agent a guided, consent-gated way to resolve the `pending` ones.

A hard constraint frames every decision: **data_loom holds no API credential of its own** (inherited from `roadmap-mcp-server`). Nothing in the daemon or the MCP server can *infer* a dependency — inference is judgment, and the only judgment in the system is the user's Claude driving the server.

## Goals / Non-Goals

**Goals:**
- Derive a per-change `dependencyReview` state (`pending` / `declared`) from proposal files, as metadata that never affects ordering.
- Let the user's agent resolve `pending` proposals through the MCP server, proposing edges and confirming with the user before any write.
- Provide a credential-free way to record "reviewed, depends on nothing" so parallel changes stop showing as `pending`.
- Surface the count of `pending` proposals in the dashboard.

**Non-Goals:**
- Shared-capability *contention* (e.g. four `card_rts` changes all modifying `presentation-layer`). Different signal, deliberately deferred.
- Any change to edge/phase/readiness computation. A reviewed workspace may legitimately stay flat.
- Dashboard-side approve/reject UI or a staging store for proposed edges. Confirmation is in-chat.

## Decisions

### 1. `declared` ≡ presence of the `## Depends On` heading, not its contents
The state is derived solely from whether the heading exists; an empty section still counts as `declared`. This is what lets a genuinely-parallel change be "reviewed" without inventing a fake edge. A new `OpenSpecClient.hasDependsOnSection(name)` detects heading presence, reusing the existing parser's heading regex, and stays separate from `readProposalDependsOn` (which reports *entries*).
- *Alternative — a sidecar review file:* rejected. The project's standing convention is to derive truth from files, not store duplicate state; the proposal already is the source of truth.

### 2. Detection is mechanical; inference is the agent's; confirmation is behavioral
The daemon and server only ever *detect* `pending` and *write what they are told*. The connecting agent reads the proposals and proposes edges. The "wait for the user to confirm" gate lives in the server's connect-time `instructions`, i.e. in the agent's behavior — **the server cannot verify a human approved**, it only receives `set_dependency` / `mark_independent` calls. The trust boundary is the user's own authenticated Claude session.
- *Alternative — daemon auto-infers on startup:* impossible (no credential) and undesirable (wrong edges silently reorder/block the roadmap).
- *Alternative — confirm in the dashboard:* rejected. The dashboard has no model; staging "proposed" edges there splits the approval from the reasoning that justifies it. In-chat keeps the "why" next to the "yes".

### 3. `mark_independent` writes an empty `## Depends On` block
Independence is recorded with the same file mechanism as a real dependency, so derivation needs no special case: an empty heading yields no entries, hence no edge, and flips the state to `declared`. The tool validates the change is open and is idempotent. It composes with `set_dependency` — a later real dependency simply appends a bullet under the same heading.

### 4. The dashboard is detection + live result only
The view renders a "N proposals need dependency review" indicator from the new field and re-renders on the daemon's existing model push. It never infers or writes. This is the "check on startup" the user experiences; the *resolution* happens in their Claude session, and the watcher-driven recompute clears the indicator live.

## Risks / Trade-offs

- **The confirmation gate is not server-enforceable.** A misbehaving MCP client could call `set_dependency` without asking. → Accepted: the user's authenticated Claude is the trust boundary; writes land in version-controlled proposal files (reviewable and revertible), and `set_dependency` already validates names.
- **An empty `## Depends On` block is indistinguishable from a hand-authored stub.** → Intended: both mean "reviewed". `declared` is defined as heading-presence precisely so the two converge.
- **Heading-detection brittleness** (`## Depends On` vs extra spacing / trailing text). → Mitigation: reuse the exact heading regex shape the existing `dependsOnInSection` parser already uses, so detection and parsing agree.
- **`card_rts` stays flat after review.** → Not a regression; it is the correct, now-*honest* outcome — five reviewed, independent changes rather than five unreviewed ones.

## Migration Plan

None. The review state is derived from proposal files on every recompute — nothing stored, no data migration. Rollout is: rebuild, restart the daemon; connected MCP clients pick up the new connect-time instructions on their next handshake. Rollback is reverting the build.

## Open Questions

- Exact wording of the connect-time `instructions` (must be firm about "confirm before writing") — to be finalized in implementation.
- Whether `mark_independent` writes a bare heading or a heading plus a `_None._` placeholder line for human readability. Leaning bare heading; placeholder is cosmetic and must not parse as an entry.
