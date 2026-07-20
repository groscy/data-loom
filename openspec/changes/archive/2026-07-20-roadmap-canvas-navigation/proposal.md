## Why

The roadmap's collapsed "archived" band predates the System Atlas. The Atlas now tells the archive's story far better — every archived change appears in *Decisions & rationale* with its date, its why, and its design, and every settled capability links back to the change that introduced or modified it. The band is a bare list of names occupying the bottom of the roadmap for no remaining reason.

At the same time the roadmap has outgrown native scrolling. A wide plan is panned with a horizontal scrollbar and a tall phase pushes the whole page vertically, so the reader loses the shape of the plan the moment it stops fitting — there is no way to see the whole DAG at once and no way to tell where the current view sits within it.

## What Changes

- **BREAKING (view behavior)**: Remove the archived "done" band from the roadmap. Archived changes are no longer listed on the roadmap tab; the Atlas is the single place history is read. The roadmap model keeps carrying archived changes — derivation and the Atlas depend on them — only the band is removed.
- Replace the roadmap's native scroll container with a **pan-and-zoom canvas**: a viewport that fills the roadmap view, with the board translated and scaled inside it. Drag to pan, wheel/trackpad to pan, pinch or modifier-wheel to zoom.
- **No scrollbars anywhere in the roadmap.** The viewport clips; navigation is by pan, zoom, minimap, and keyboard.
- Add a **minimap**: a scaled overview of the whole canvas showing every phase column and change card plus a viewport rectangle, appearing only when the roadmap is larger than the viewport. Clicking or dragging it moves the viewport.
- Add **fit-to-view and zoom controls**, an initial fit on first render and on project switch, and keyboard navigation (arrows pan, `+`/`-` zoom, `0` fits) so the canvas stays reachable without a pointer.
- Preserve the viewport across live daemon pushes so an incoming model update does not throw away the reader's position.
- Fix a pre-existing connector-anchoring bug surfaced while verifying the above: edges anchored to a card's layout position, which assumes a fixed card height, so they met taller cards up to ~35px off centre. They now anchor to each card's measured centre.

Out of scope: the MCP Topology board keeps its current fixed layout — the same treatment there can follow as its own change.

## Capabilities

### New Capabilities

None. Everything here is a change to how the existing roadmap view presents and navigates itself.

### Modified Capabilities

- `roadmap-view`:
  - **Removed** — *Archived changes as a collapsed done band*. Superseded by the Atlas's decisions section and capability provenance.
  - **Modified** — *Horizontal scrolling for wide roadmaps* becomes a pan-and-zoom canvas requirement covering both axes with no scrollbars, keeping the existing guarantees that the canvas grows with the plan, that a small plan stays centered, and that dependency connectors track card positions.
  - **Added** — minimap overview with a viewport indicator; viewport controls and keyboard navigation; viewport preservation across model pushes.

## Impact

- [`public/index.html`](public/index.html) — remove the `#doneband` section; add the canvas viewport wrapper, minimap, and zoom controls around `#board`.
- [`public/app.js`](public/app.js) — delete `renderDoneBand()`, the `doneBand` ref, the `doneCollapsed` state and the `render()`/`setProjects()` call sites; add viewport transform state, pointer/wheel/key handlers, fit-to-view, and minimap rendering driven by the positions `renderBoard()` already computes.
- [`public/style.css`](public/style.css) — remove `.doneband*` / `.done-chip` rules; replace `.board-wrap` overflow scrolling with a clipping viewport; add minimap and control styling for both themes.
- [`openspec/config.yaml:15`](openspec/config.yaml:15) — the recorded roadmap-model convention still says archived changes appear in a collapsed done band; update that line.
- [`README.md:42`](README.md:42) — "Archived work collapses into a done band…"; point the reader at the Atlas instead.
- [`src/types.ts:30`](src/types.ts:30) — the comment explaining `phase: 0` refers to the done band; the field stays, the comment needs rewording.
- No daemon, derivation, API, MCP, or dependency changes. `derive.ts` keeps emitting archived nodes (declared dependencies on archived changes resolve through them) and `atlas.ts` keeps reading the archive directly. The SPA stays dependency-free vanilla JS — no graph or canvas library is introduced.
- The repo has no test suite and CI runs only `npm ci` + `npm run build`, so this change is verified by a manual checklist in `tasks.md`, matching how prior view changes were verified.

This is the follow-up the Atlas change anticipated: `add-system-atlas` listed removing the done band as an explicit non-goal, noting the band should stay "a quick roadmap affordance (a later change could link it to the atlas)". With the Atlas shipped and its recency overlay in place, the better link is no band at all.
