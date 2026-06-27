## Why

The roadmap currently lays phases out as side-by-side columns. As the number of phases grows this reads awkwardly and doesn't communicate "this phase flows into the next." Stacking phases vertically as labeled "bands" — each a container holding its changes in a row, connected by a downward arrow — reads as a top-to-bottom implementation plan and scales better. This restructures the roadmap to that layout.

This is a roadmap-view rendering change on a settled capability, so it is a Phase 1 change.

## What Changes

- Render each phase as a horizontal, dashed-bordered **band**, stacked vertically by ascending phase (Phase 1 on top).
- Within a band, change cards flow in a **row** (wrapping when there are many).
- Draw a **downward phase-progression arrow** between consecutive bands.
- Keep **dependency relationships** as dashed arrows between the specific cards involved.
- Status/readiness colours, badges, the conflicts banner, the project selector, and the archived done-band are all unchanged — only the phase layout changes from columns to stacked bands.

## Capabilities

### New Capabilities
<!-- None. This restructures how roadmap-view lays out phases. -->

### Modified Capabilities
- `roadmap-view`: The phased roadmap is rendered as vertically stacked phase bands (each a labeled container with its changes in a row) connected by phase-progression arrows, instead of side-by-side phase columns. Dependencies remain visible as arrows between cards.

## Impact

- **`public/` only** (roadmap-view rendering): `renderBoard` is restructured to emit stacked bands; the dependency-edge drawing is adapted to the new positions; CSS for bands and arrows. No daemon, model, or capability-data change.
- Visual change to the Roadmap tab; the MCP tab and everything else are untouched.
