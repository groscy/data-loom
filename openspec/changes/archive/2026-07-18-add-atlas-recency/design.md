# Design — Atlas recency overlay

## Context

[`add-system-atlas`](../add-system-atlas/proposal.md) derives and serves per-requirement **provenance** (the change that introduced a requirement and the changes that later modified it, each with an archive date) and displays it as header dates + a "shaping decisions & history" section. This change adds the *personalized* layer on top: **"what changed since *you* last looked."** It is deliberately a separate, dependent change so the atlas ships and is useful on its own, and so the overlay's client-side UI-state concerns stay out of the derivation.

The whole overlay is a pure `atlas-view` addition — it introduces **no new daemon data**: it compares provenance dates already in the `AtlasModel` against a browser-local cursor.

## Since-last-visit — and why not the alternatives

The reference point for "changed" is the viewer's own last visit:

- *Top-K most recent* — mark the N latest-touched requirements. Frozen/absolute: always shows something even when nothing is actually new to this viewer.
- *Since a release / git tag* — coarser, and needs git state the daemon deliberately doesn't read.
- **Since your last visit** *(chosen)* — fits DataLoom's single-local-user, derived stance, and is the most literal reading of "quickly find their way to the new parts." The overlay lights up only when *new* proposals were archived between two visits; a quiet week shows a clean page.

## Client-side persistence

The cursor is stored in the browser (`localStorage` `lastSeenAt`) — it is **per-viewer UI state, not workspace truth**, so it must never be written into the workspace (that would violate *derived, not stored* for the model, and would leak one viewer's read-state into shared files). The daemon computes the provenance dates; the browser owns the "have I seen this" cursor. Because the comparison is entirely client-side, the change needs no endpoint and no server state.

**Date granularity.** Archive folders are day-granular (`2026-07-11`), while `lastSeenAt` is a timestamp. The comparison treats an archive date as the change's instant (start-of-day) and marks a requirement when that instant is at or after the last visit, so a change archived the same day the user last looked is not perpetually re-flagged. A single, documented rule avoids off-by-a-day flicker.

## First-visit baseline

On the first visit (no stored cursor) the baseline is seeded to "now", so a brand-new viewer sees **nothing** marked as stale rather than a wall of dots. First-time understanding is carried by the atlas overview and the outline, not the overlay; the overlay's job begins on the *second* visit.

## Recency-driven disclosure

Because the atlas's provenance is *per-requirement*, the overlay can drive the building-block page's default disclosure: requirements changed since the last visit are **expanded**, the rest stay **collapsed** to their titles. The overlay becomes the navigation — you land on a 16-requirement page and your eye goes straight to the one changed requirement. The 46:8 ADDED:MODIFIED ratio across the archive keeps this sparse and precise: most pages have zero or one changed requirement, never a wall.

## Non-goals

- **Scenario-level marking.** Provenance stops at the requirement; flagging *which* scenario within a modified requirement changed would need text-diffing bodies, beyond the title-join. A possible future refinement.
- **Server-side or multi-user read state.** Single local user; the cursor is client-side only. No sync, no accounts.
- **Any change to the derivation.** The daemon is untouched; the overlay rides the provenance already served.

## Risks

- **First-visit baseline** — seeding to "now" means a genuinely new user sees nothing marked. That is the correct trade to avoid a wall of dots; the overview (not the overlay) carries first-time understanding.
- **Cursor lost on storage clear** — clearing browser storage reseeds the baseline (everything reads as "seen"). Acceptable for a local convenience cursor; nothing important is lost, and a "mark all read" is the same operation the user would want anyway.
