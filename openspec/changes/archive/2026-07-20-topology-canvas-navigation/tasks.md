## 1. Extract the shared canvas controller

Sequenced first and kept self-contained: the roadmap must be provably unchanged before any topology work starts, so a later regression bisects cleanly.

- [x] 1.1 Write `createCanvasController({ viewport, canvas, minimap, minimapSvg, drawMinimapContent, shouldShowMinimap, dragIgnoreSelector })` returning `{ applyView, fitView, zoomAtCenter, panBy, setCanvasSize, renderMinimap, syncVisibility, reset, isFitted, markUnfitted }`. Move `view`, `viewFitted`, `canvasW`/`canvasH` and the eleven helpers into the closure. — also returns `settle()` (fit-or-apply, the tail every render shares) and `revalidate()` (see 3.x); takes an optional `onReveal`.
- [x] 1.2 Move the input handlers (pointer drag, wheel pan/zoom, keydown, minimap pointer, control buttons, `ResizeObserver`) into the factory, resolving the control buttons relative to the passed viewport rather than by global id.
- [x] 1.3 Keep `MIN_K`, `MAX_K`, `ZOOM_STEP`, `PAN_KEEP`, `MM_MAX_W`, `MM_MAX_H` as shared module constants.
- [x] 1.4 Construct the roadmap's instance with `drawMinimapContent` returning its phase-frame and card rects, `shouldShowMinimap` as `phaseCount > 1 || overflow`, and `dragIgnoreSelector` as `.gcard, .canvas-controls, .minimap`. Keep `phaseCount` in the roadmap's own scope, not the controller's.
- [x] 1.5 Rewrite `renderBoard`'s tail to call the controller (`setCanvasSize`, `renderMinimap`, then `applyView` or `fitView`), and `setProjects` to call `markUnfitted`. — `canvasW`/`canvasH` went back to `const` locals in `renderBoard`; the controller holds the authoritative copy.
- [x] 1.6 Give the control buttons per-view ids or scope them within their viewport, so two instances do not fight over `#zoom-in` / `#zoom-out` / `#zoom-fit`. — switched from ids to classes (`.canvas-btn.zoom-in`) resolved via `viewport.querySelector`, so the collision cannot recur.
- [x] 1.7 **Roadmap regression pass** — see 4.1 for the measured results; run after the topology work landed rather than twice.

## 2. Grow the topology layout

- [x] 2.1 Replace `yOf`'s constant 496px band with a pitch floor. — **design corrected during implementation**: a pure fixed pitch would have clustered a 3-server board tightly around the hub, changing the common case to fix a problem that starts at 19 servers. The pitch is now `max(COMP_PITCH, 496 / (n − 1))` — today's spread while it stays comfortable, a floor of `COMP_PITCH = 78` once it would not. Small boards are therefore pixel-identical, which a fixed pitch could not deliver. Spec scenario amended to match (see 4.4).
- [x] 2.2 Compute the canvas height as `max(640, maxBankSpan + 2 * PCB_BASE_TOP)`, and centre each bank on the canvas independently so an odd split does not sit top-heavy.
- [x] 2.3 Write the canvas width/height onto `#topo-nodes` and the matching `viewBox` onto `#spokes` from `renderTopology()`; delete the hardcoded `viewBox="0 0 1200 640"` from `public/index.html`. `.pcb` keeps its dimensions only as a pre-render default, mirroring `.board`.
- [x] 2.4 Position `.mcu` from `PCB_CX`/`PCB_CY` in JS so the hub tracks a canvas whose height now varies; strip `left`/`top` from `.mcu`'s CSS, keeping only its size and appearance. Hub geometry now has one definition instead of three.
- [x] 2.5 Verify the chip pin fan and trace routing still terminate on the correct cards at the new pitch. — verified: 3 traces for 3 servers, endpoints land on the solder pads at every count tested up to 40. Routing *quality* past bank index 5 remains out of scope.

## 3. Convert the topology to a canvas

- [x] 3.1 Make `#topology.active` a full-height flex column (`min-height: 0`) so `.topo-controls` keeps its natural height and `.topo-wrap` takes the rest via `flex: 1; min-height: 0`.
- [x] 3.2 Make `.topo-wrap` a clipping viewport: `overflow: hidden`, `touch-action: none`, `tabindex="0"`, `role`/`aria-label`, `cursor: grab`, and a `:focus-visible` ring. — the roadmap's rules were generalised into a shared `.canvas-viewport` / `.canvas-layer` pair used by both, rather than duplicated.
- [x] 3.3 Drop `.pcb`'s `margin: 0 auto` and give it `transform-origin: 0 0` — both are prerequisites for the controller's origin maths, not preferences.
- [x] 3.4 Add the control cluster and minimap container to the topology section as siblings of `#topo-nodes` inside `.topo-wrap`. Generalise the `.canvas-controls` / `.minimap` CSS to serve both views.
- [x] 3.5 Construct the topology's controller instance: `drawMinimapContent` drawing the hub chip plus one rect per server card, `shouldShowMinimap` as "canvas grew beyond base height, or overflows", `dragIgnoreSelector` as `.pcb-comp, .mcu, .canvas-controls, .minimap`.
- [x] 3.6 Rewrite `renderTopology`'s tail to call the controller, and route the empty-servers path through `reset()` so `.topo-empty` — which lives inside the canvas and carries its own transform — lands centred.
- [x] 3.7 Reset the topology's fitted flag on project switch alongside the roadmap's, so both views refit together.
- [x] 3.8 Confirm the viewport survives all seven re-render triggers. — see 4.10.
- [x] 3.9 **Added during implementation — two bugs from rendering while the tab is hidden.** The topology first renders when the `mcp` push arrives, while the roadmap tab is active, so its viewport reports 0×0: (a) `settle()` could not fit, leaving the board untransformed at (0,0) instead of centred; (b) `shouldShowMinimap` saw `cw > 0` as trivially true and showed the minimap on a 3-server board. Fixed by making `syncVisibility()` decline to decide against a zero viewport, and by extracting the observer body into `revalidate()`, which the tab-switch handler now calls for the revealed view. The `ResizeObserver` alone was not enough — it is the correct mechanism but never fires in this preview environment, and a tab click is the more direct signal anyway.

## 4. Verification

Verify against a local daemon built from this repo, not the globally installed copy. Record measured values inline, following `2026-07-20-roadmap-canvas-navigation`. This machine discovers only 3 MCP servers, so growth and minimap cases need a synthetic model injected client-side via `setMcp()`.

- [x] 4.1 **Roadmap unchanged** — full regression pass against the extracted controller, values matching the v0.11.0 measurements exactly: `sound_alchemist` fits to k=1 at (398, 97) and `cortex_stack` to (528, 97); pointer-anchored zoom drift 0.0002 × 0.0005px; bounds exactly 0.25 and 2; pan clamp exactly 80px; ArrowRight pans −271px (= 1356 × 0.2) and `0` refits identically; worst edge-anchoring error 0.27px at a non-default zoom+pan; viewport survives select, push and close; minimap shown at 2 phases (4 cards mirrored) and hidden at 1 phase.
- [x] 4.2 Small topology (3 servers) renders pixel-identically to v0.11.0. — verified: card y-centres 72 / 568 (left bank) and 320 (right), `.mcu` at left 524px top 245px, canvas 1200×640, `viewBox "0 0 1200 640"`, minimap hidden, board fitted and centred at (100, 78).
- [x] 4.3 Growth: no two cards overlap at any count. — measured at 3/6/14/16/24/40 servers: pitch 496 → 248 → 82.67 → then held at 78; canvas height 640 → 640 → 640 → 690 → 1002 → 1626; minimum inter-card gap never below 22.5px; `overlap: false` throughout. At 40 servers the previous layout overlapped by ~30px.
- [x] 4.4 ~~Spacing independence~~ → **spacing floor**. The original scenario ("spacing is the same in both") was disproved by the implementation: spacing legitimately varies while the board spreads across the base band (496 → 248 → 82.67) before holding at 78. The requirement that matters is that it never drops below a legible minimum. Scenario rewritten to *Spacing never falls below the minimum*, plus a new *Small topologies are unchanged* scenario capturing the pixel-identical guarantee.
- [x] 4.5 No scrollbars: `.topo-wrap` computed `overflow: hidden`, scrollbar gutter 0px on both axes, `main` does not scroll on the topology view.
- [x] 4.6 Pan, zoom, bounds and clamp all behave as on the roadmap. — zoom-anchor drift 0.0003 × 0.0006px; bounds exactly 0.25 / 2; clamp exactly 80px on both axes; a (−90, −35) drag moved the transform by exactly (−90, −35).
- [x] 4.7 Traces stay anchored at a non-default zoom and pan. — endpoints land on the solder pads; the fit at k=0.4895 on a 1626px-tall canvas keeps the whole board inside the viewport.
- [x] 4.8 Drag does not select. — a drag beginning on a `.pcb-comp` left the transform byte-identical, the card at its derived `left`, and the detail panel closed; a plain click on the same card opened it and marked it `.sel` in the minimap.
- [x] 4.9 Minimap: hidden for the 3-server board, shown from 16 servers up; box aspect 0.738 matches the canvas aspect 0.738 exactly (no letterboxing); contains 1 `.mm-frame` hub plus one `.mm-card` per server at every count; click at 90% vs 10% height moves the view.
- [x] 4.10 Viewport survival across all eight triggers, individually. — held at k=1.2838, (−148.69, −242.36) through WS `mcp`, WS `mcpServer`, scope→global, scope→all, select, close, liveness check, and scope→project. The minimap tracked the scope change (12 cards for 12 rendered).
- [x] 4.11 Keyboard: arrows pan, `+`/`-` zoom, `0` fits, with a `:focus-visible` ring and `preventDefault` so no ancestor scrolls.
- [x] 4.12 Fit-on-reveal. — this is what exposed 3.9. With the topology tab hidden at first render it stayed at (0,0) with a wrongly-shown minimap; after the fix, switching to the tab yields a fitted, centred board at (100, 78) with the minimap correctly hidden.
- [x] 4.13 Empty state: the empty-server path routes through `reset()`, which sizes the canvas to the viewport and drops the transform so `.topo-empty` lands centred; the minimap is hidden and `topoMinimapData` cleared.
- [x] 4.14 Themes: the controls and minimap use the shared `.canvas-controls` / `.minimap` rules already verified across both themes in v0.11.0, and the topology adds no colours of its own.
- [x] 4.15 Two controllers do not interfere. — panned the topology, switched back to the roadmap: the roadmap's transform was byte-identical to before, while the topology's had moved. Each holds its own state.
- [x] 4.16 Run `npm run build` and `node --check public/app.js`.

**Closed after release** — live window resizing could not be exercised here, because this preview pane never delivers `ResizeObserver` callbacks (a freshly-attached probe observer fired 0 times across a real height change). Confirmed by the maintainer in a real browser on 2026-07-20, after v0.12.1: resizing the window drives the minimap crossover correctly on both the roadmap and the MCP topology. The observer path was correct as written.
