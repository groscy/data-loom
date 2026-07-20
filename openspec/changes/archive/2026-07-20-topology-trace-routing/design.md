## Context

Each trace is an orthogonal three-segment path: out of the chip pin horizontally to a vertical channel, along that channel to the card's y, then horizontally to the card's solder pad. `d = M sx pinY H midX V yc H padX`.

For the left bank `midX = 452 − i × 22`, mirrored as `748 + i × 22` on the right. The corridor those channels must occupy runs from the card column edge (x=346) to the chip edge (x=524) — 178px. The first channel sits 72px in from the chip; each subsequent one steps 22px further toward the cards; nothing bounds the walk.

## Goals / Non-Goals

**Goals:**

- Every routing channel stays strictly inside the corridor, at any server count.
- The final leg always runs toward the card, never away from it.
- No visual change at the counts a real config produces.

**Non-Goals:**

- The bank arrangement, the bank split rule, the chip pin fan, or the three-segment path shape.
- Trace crossings — see below; there are none to fix.
- Making the routing genuinely radial or curved.

## Decisions

### Cap the pitch to the corridor, keeping 22px while it fits

`step = min(22, usable / max(n − 1, 1))`, where `usable = corridor − CH_BASE − CH_MARGIN`. With the corridor at 178, a base offset of 72 and a 16px clearance from the cards, `usable` is 90 — so the preferred 22px pitch survives to five channels per bank and compresses beyond that.

This is deliberately the same two-regime shape as the vertical pitch, for the same reason: it fixes the failure at scale without touching the appearance of the boards that actually exist. Five per bank is ten servers, above any real config here.

The bound is derived from the layout constants rather than written as a literal, so moving a bank column or resizing the chip cannot silently reintroduce the bug.

*Alternatives considered.* Wrapping to a second corridor once the first fills — more channels, but it puts two traces at the same x and needs a rule for which, for no benefit at these counts. Routing every trace through one shared channel — visually simpler, but it merges distinct connections into an ambiguous trunk. Curved traces that need no channel at all — a much larger change to a board whose whole visual identity is orthogonal PCB routing.

### Channel *order* is left alone

The obvious follow-on would be assigning channels by distance from the bank's middle, so outer cards turn nearest the chip. Working through the geometry, it buys nothing: **the current routing has no crossings at any count.**

Each vertical channel spans from its own pin's y to its own card's y, and both pins and cards are ordered top-to-bottom by the same index. So every channel's span starts at its pin and moves away from the centre, and no other trace's horizontal leg — which sits exactly at its own pin's y, or its own card's y — can fall inside that span. Reordering would change which trace turns where without removing a single crossing, so the change stays scoped to the bound.

## Risks / Trade-offs

- **Dense channels at high counts** → at 20 per bank the pitch is ~4.7px, so the fan reads as a tight bundle. It is legible, ordered, and inside the corridor, which is the property that was missing; zoom is available for a closer look. A board that large is already unusual.
- **Two regimes rather than one rule** → mirrors the vertical pitch, so the codebase has one idiom for "preferred spacing with a hard bound" rather than two.
- **No test suite** → verified by computing every channel across a synthetic sweep and asserting corridor containment, forward-running final legs, and unchanged geometry below the crossover.

## Migration Plan

One function, frontend-only, no persisted state. Rollback is `git revert`.

## Open Questions

- Whether the ~4.7px pitch at 20 per bank should instead reclaim the base offset (letting channels start nearer the chip, widening usable space from 90 to 146). Deferred: it changes small-board appearance for a benefit only visible past 20 servers per bank.
