## Why

The roadmap lays phases out left-to-right across a **fixed-width design canvas**, dividing that width evenly among however many phases exist. Past ~3–4 phases the per-phase spacing shrinks below a card's width, so phase frames and change cards overlap and clip — a real project like `cortex_stack` with 9 phases is unreadable (cards pile on top of each other, titles are cut off). The roadmap must stay legible for plans of any depth, not just small ones.

## What Changes

- Give each phase a **fixed horizontal footprint** instead of squeezing all phases into a constant total width, so the roadmap canvas grows wider as phases are added and columns never overlap.
- Make the roadmap board **horizontally scrollable** when its computed width exceeds the viewport, so deep plans are pannable rather than crushed.
- Keep the current behaviour when the roadmap fits: a plan narrow enough to fit stays centered with no scrollbar.
- Preserve non-overlapping placement of phase frames, change cards, and dependency edges at any phase count (edges/SVG viewBox track the dynamic canvas width).
- Reconcile the `roadmap-view` spec, which still describes vertically-stacked phase bands, with the shipped horizontal-column layout that this change fixes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities
- `roadmap-view`: the phased layout requirement changes so phase columns keep a fixed footprint and the roadmap scrolls horizontally when phases exceed the viewport width, replacing the stale vertically-stacked-bands requirement with the horizontal-column reality it fixes.

## Impact

- `public/app.js` — `renderBoard` geometry: replace fixed-canvas even-distribution (`span = (G_W - 2·G_MX) / (n-1)`) with fixed per-phase spacing and a dynamically computed canvas width; size the `#board` element and `#edges` SVG viewBox to that width.
- `public/style.css` — `.board` / `.board-wrap`: width becomes content-driven (set from JS) rather than a hard-coded `1180px`; enable horizontal overflow scrolling on the roadmap scroll container and center only when content fits.
- `public/index.html` — minor, if a scroll wrapper element is needed around the board.
- No change to the daemon, phase derivation, or the roadmap data model — this is a client-side rendering fix. The MCP topology view is out of scope.
