## Context

Today `renderBoard` emits one `.phase-col` per phase inside a horizontal flex `.board`, and `drawEdges` draws dependency curves between card elements via an SVG overlay. The change is confined to the view layer (`public/`): restructure the board into vertically stacked bands and keep the SVG edge overlay, which already measures element rects and therefore adapts to the new positions.

## Goals / Non-Goals

**Goals:**
- Phases as vertically stacked, dashed-bordered bands (Phase 1 top), each with a phase label and its cards in a row.
- A downward arrow between consecutive bands.
- Dependency arrows between specific cards preserved.

**Non-Goals:**
- Tool-pool "lanes" / colouring by lane (a separate, larger feature). Colours stay status/readiness.
- Any model or daemon change.

## Decisions

### D1 — Stacked bands
`.board` becomes a vertical flex column. Each phase renders as a `.phase-band` (dashed rounded border, padding) containing a small phase label and a `.phase-band-cards` row (flex, wrap). Cards keep their existing markup and a sensible fixed-ish width so a row reads cleanly.

### D2 — Phase-progression arrows
Between consecutive bands, render a centered downward arrow (a small element, e.g. an SVG/character "↓") indicating phase order. It is decorative (phase N → N+1), distinct from dependency arrows.

### D3 — Dependency arrows preserved
Keep the existing SVG overlay (`#edges`) spanning the board. `drawEdges` still draws an arrow from each dependency card to its dependent card using measured rects; with the new layout these run roughly top→down (earlier band to later band) or within a band. Render dependency edges dashed to match the mock, and keep them visually distinct from the solid phase-progression arrows.

### D4 — Everything else unchanged
Status/readiness badges, the conflict `.warn` treatment, the next-up accent ring, the conflicts banner, the project selector, and the archived done-band keep their current behavior. The done-band stays below the phase bands.

## Risks / Trade-offs

- **Edge overlay alignment** with a vertical, wrapping layout → `drawEdges` measures live rects relative to the board wrap, so it stays correct; re-run on resize (already wired) and after render.
- **Many changes in one band** → the row wraps; bands grow taller. Acceptable; matches the mock's intent.
- **Arrow clutter** if a band has many cross-band dependencies → dependency arrows stay thin/dashed and subordinate to the layout; acceptable for the local tool.

## Migration Plan

Pure view change; no migration. Ship in the next exe release alongside phase-planning.

## Open Questions

- **Band labels** — keep the simple "Phase N" label (current) inside/above each band. A future tweak could summarize the band (count, readiness mix); deferred.
