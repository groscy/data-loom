## Why

The MCP topology board has the opposite problem to the roadmap, and it is currently invisible. The canvas is frozen at 1200×640 and servers are **compressed** into a constant 496px band — `yOf` spreads *n* servers at a pitch of `496 / (n − 1)`. Cards are ~56px tall, so from **19 servers** the banks overlap silently, and from 42 the trace routing channels leave the viewBox entirely. Nothing caps, wraps, or scrolls; the layout simply degrades.

That threshold is far from today's reality — this machine discovers 3 servers, and discovery reads only three config sources, so the realistic ceiling is 10–15. But the failure is silent when it arrives, and the fixed board already forces `main` to scroll the whole page whenever the window is under ~1250px wide.

The roadmap answered exactly this class of problem in `roadmap-canvas-navigation` (v0.11.0): grow the canvas with the content, then navigate it by panning and zooming inside a clipping viewport with a minimap. That change deferred the topology explicitly — "the same treatment there can follow as its own change". This is that change. Navigation alone would not be worth having here; coupling it to a layout that grows is what makes it earn its place, and fixes the overlap in the same stroke.

## What Changes

- **Grow instead of compress.** Replace the constant 496px band with a fixed per-server vertical pitch, so the canvas height grows once a bank exceeds what 640px holds. Servers keep a legible spacing at any count; the ≥19-server overlap stops being possible.
- Give the topology a **clipping viewport** with no scrollbar on either axis, matching the roadmap.
- Add **pan, zoom, fit-to-view, keyboard navigation and a minimap** to the topology board, with the same gestures and controls as the roadmap so the two views behave identically.
- **Extract the roadmap's pan/zoom/minimap module into a shared canvas controller** parameterized by its elements, and drive both views from it. Roughly 250 lines stop being roadmap-specific. **This re-touches code shipped in v0.11.0**, so the roadmap's behavior must be re-verified against its own spec.
- Consolidate the **hub geometry**, currently duplicated across `.mcu`'s CSS position, `PCB_CX`/`PCB_CY`/`CHW` in JS, and the `viewBox` literal in HTML. A canvas that changes size cannot keep three hardcoded copies in agreement.
- Fix the click-vs-drag collision: a pan that ends on a server card must not select it.

Out of scope: the trace routing channels (`midX = 452 − i × 22`), which reverse direction past bank index 5 and are a separate cosmetic concern; the Atlas view, which is a document, not a canvas.

## Capabilities

### New Capabilities

None. This changes how two existing views lay out and navigate themselves.

### Modified Capabilities

- `topology-view`:
  - **Modified** — *Hub-and-spoke centered on Claude Code*, to state that the layout grows with the server count rather than compressing into a fixed area, and that spacing per server is independent of how many there are.
  - **Added** — a clipping viewport with no scrollbars; pan and zoom; minimap overview; viewport controls and keyboard navigation; viewport preservation across the view's frequent re-renders.
- `roadmap-view`:
  - No requirement changes. The shared-controller extraction is a refactor behind the existing requirements — listed here only because the work touches it and its spec is the regression contract.

## Impact

- [`public/app.js`](public/app.js) — extract the canvas controller from the roadmap section into a factory; rewrite `yOf` to a growing pitch; size the topology canvas and its `viewBox` from JS; add the topology controller instance, its pointer/wheel/key handlers and minimap; guard `.pcb-comp` against drag-selection.
- [`public/index.html`](public/index.html) — add the viewport wrapper attributes, control cluster and minimap container to the topology section; remove the hardcoded `viewBox="0 0 1200 640"` from `#spokes`.
- [`public/style.css`](public/style.css) — make `#topology.active` a flex column and `.topo-wrap` a clipping viewport; drop `.pcb`'s `margin: 0 auto` and fixed dimensions; set `transform-origin: 0 0`; derive `.mcu`'s position from the canvas rather than hardcoding it; generalise the canvas-control and minimap rules to serve both views.
- No daemon, derivation, discovery, API, or MCP changes. The SPA stays dependency-free vanilla JS.

Known hazards this change must not regress, carried from the analysis: `.topo-wrap` is currently `position: relative` and nothing else, so `main` will keep scrolling and the browser will steal wheel gestures without `touch-action: none`; `.pcb`'s `margin: 0 auto` and default `transform-origin: 50% 50%` both contradict the controller's origin math; `clearTopo()` destroys every child of `#topo-nodes`, so overlays must be siblings; `.topo-empty` lives inside the canvas and already carries its own `transform`; the topology re-renders fully on scope change, selection, close, liveness check and every WS push, so the viewport must survive all of them; and tab switching never calls `renderTopology()`, so a fit-on-reveal hook is needed.
