## Context

The roadmap board became a pan/zoom canvas in `roadmap-canvas-navigation` (v0.11.0). The topology board was deferred there by name. Retrofitting it is not a copy-paste, because the two boards are built on opposite premises.

The topology layout is entirely constant. `renderTopology()` splits the visible servers into two banks by array order (`half = ceil(n/2)`), places the left bank at canvas x=150 and the right at x=854, and distributes each bank vertically with `yOf(n, i) = n <= 1 ? 320 : 72 + i * (496 / (n - 1))` — a **fixed 496px band regardless of n**. Cards are ~56px tall, so the pitch drops below the card height at 10 per bank: from 19 servers the cards overlap, and nothing caps or wraps. The hub is a CSS-positioned `.mcu` at `left: 524px; top: 245px`, whose centre (600, 320) is independently restated as `PCB_CX`/`PCB_CY` in JS and as `viewBox="0 0 1200 640"` in HTML — three copies of one geometry in three languages.

The board also re-renders far more often than the roadmap: every WS `mcp` and `mcpServer` push, every scope-chip click, every selection and deselection, and both ends of a liveness check all call `renderTopology()`, which tears down and rebuilds all DOM and the entire SVG string. `clearTopo()` removes every child of `#topo-nodes` except `#spokes`, but never touches `#topo-nodes` itself — the same invariant that lets `#board` carry a surviving transform.

Scale is small and structurally bounded: discovery reads `~/.claude.json` (global + per-project) and `~/.claude/.mcp.json`, nothing else. This machine has 3 servers; a heavy user might reach 10–15. The overlap threshold of 19 is therefore a latent bug, not a live one — which is why navigation alone was rejected as the scope: it would add chrome that never appears, while leaving the only real defect in place.

## Goals / Non-Goals

**Goals:**

- The topology layout grows with the server count instead of compressing, so per-server spacing is independent of how many there are and overlap is not reachable.
- The topology is navigated exactly like the roadmap: clipping viewport, drag/wheel pan, pointer-anchored zoom, fit, keyboard, minimap. No scrollbar on either axis.
- One canvas controller serves both views, so the two cannot drift apart.
- The roadmap's shipped behavior is preserved exactly; its spec is the regression contract.
- The hub geometry has one definition.

**Non-Goals:**

- Trace routing quality. `midX = 452 − i × 22` reverses direction past bank index 5 and collides with the card column past 14. Growing the canvas does not fix it and this change does not attempt to; it is a separate cosmetic concern.
- Changing the two-bank arrangement, the bank split rule, or making the layout genuinely radial.
- The Atlas view. It is a scrolling document, not a canvas, and `main`'s native scrolling is correct for it.
- Restarting-animation jitter: `drawTraces` replaces `innerHTML` wholesale, so every `lm-dash` pulse restarts in lockstep on each re-render. Pre-existing, visible today, and orthogonal.

## Decisions

### Extract a canvas controller as a factory, not a class hierarchy

`createCanvasController({ viewport, canvas, minimap, minimapSvg, onFit })` returns `{ applyView, fitView, zoomAtCenter, panBy, setCanvasSize, renderMinimap, syncVisibility, reset, isFitted }` and owns its own `view`, `viewFitted`, `canvasW/canvasH` and input handlers. Each view constructs one at module load.

A factory beats a class here because there is no inheritance to model and no shared mutable state to protect — two independent instances with closed-over element refs is the smallest thing that works. It also keeps the diff mechanical: the existing functions already close over module-level refs, so the change is parameterising those refs, not restructuring logic.

*Alternatives considered.* Duplicating the module was offered and rejected: two copies of pan/zoom/clamp/minimap maths will drift, and the roadmap's own bug history (stuck transitions, unretained observer, fallback card heights) shows how much subtlety lives in there. A class with subclasses per view would formalise a difference that does not exist — the views differ in what they draw, not in how they are navigated.

### The minimap's content is a per-view callback

The controller owns the minimap box, its `viewBox`, the viewport rectangle and all the pointer mapping. What it cannot own is the *shapes*: the roadmap draws phase frames plus measured card rects, the topology draws the hub chip plus server cards. So the controller takes a `drawMinimapContent()` callback returning an SVG string, and appends its own `.mm-view` rect after it.

### Minimap visibility becomes a per-view predicate

The roadmap shows the minimap at `phaseCount > 1 || overflow`. "Phases" mean nothing here. The topology's equivalent signal for "there is structure worth surveying" is the canvas having grown beyond its base height — i.e. more servers than the base board holds — or plain overflow. So the controller takes a `shouldShowMinimap()` predicate, defaulting to overflow-only, and each view supplies its own.

This keeps the roadmap's shipped rule intact while letting topology express a different one, rather than forcing a single rule that fits neither.

### Growth: a pitch floor that extends the canvas

The pitch is `max(COMP_PITCH, baseBand / (n - 1))` — the existing spread while it stays comfortable, a fixed floor once it would not. The canvas height becomes `max(640, maxBankSpan + 2 * margin)`, and each bank is centred on it so an odd split does not sit top-heavy.

A pure fixed pitch was the first plan and is wrong. It would cluster a 3-server board tightly around the hub with large empty margins, changing the look of the common case to fix a problem that only appears at 19. Keeping the spread below the crossover means small boards are **pixel-identical** to the fixed-band layout — verified: 3 servers still land at y-centres 72/568/320 on a 1200×640 canvas.

The crossover lands at 8 per bank (16 servers), slightly before overlap would have begun at 10 per bank, which buys a comfortable 78px pitch rather than waiting for cards to touch.

*Alternative considered.* Keeping the compressing band and relying on zoom to recover legibility. Rejected: zooming into an overlapping layout does not separate the cards, it magnifies the overlap. Compression is a layout bug and has to be fixed in the layout.

### The canvas size, the SVG viewBox and the hub position all come from JS

Once height is dynamic, the `viewBox="0 0 1200 640"` literal and `.mcu`'s CSS `left`/`top` are wrong by construction. `renderTopology()` writes `#topo-nodes`'s width/height and `#spokes`'s `viewBox`, exactly as `renderBoard()` does, and positions `.mcu` from `PCB_CX`/`PCB_CY`, which become the single source of truth. The CSS keeps only `.mcu`'s size and appearance.

### `.pcb` loses `margin: 0 auto` and gains `transform-origin: 0 0`

Both are prerequisites, not preferences. The controller's `zoomAt` inverse-mapping assumes the canvas origin coincides with the viewport origin; auto-centring inserts an unknown offset and a 50% origin makes the scale pivot move as the canvas resizes. Centring is done by the fit transform instead, which is where the roadmap already does it.

### The empty state is handled by resetting the canvas, as on the roadmap

`.topo-empty` lives inside `.pcb` and carries its own `transform` for centring. Under a canvas transform it would pan away with the board. The controller's `reset()` (the roadmap's `resetCanvasToViewport`) sizes the canvas to the viewport and drops the transform, which puts the empty state back where it belongs. Its own transform composes with the parent's — nesting is fine, a second transform on the same element is not.

### Overlays are siblings of `#topo-nodes`, inside `.topo-wrap`

`clearTopo()` destroys every child of `#topo-nodes` on every re-render, and anything inside would scale with the transform. The controls and minimap therefore sit in `.topo-wrap` alongside the canvas — mirroring the roadmap, and reusing its CSS. They stay bottom-left for the same reason: `.detail` is fixed against the right edge and, at 340–362px, covers the right bank's canvas x-range of 854–1050 on any window under ~1560px.

### Fit-on-reveal needs a new hook

The topology renders correctly while hidden today only because nothing is measured — all geometry is constant. Adding fit re-introduces the 0×0 viewport problem the roadmap solved with `viewFitted` plus a `ResizeObserver`. But tab switching never calls `renderTopology()`, so the observer is the only thing that will fire on reveal. The controller's observer already carries a pending fit; the topology instance needs one attached to `.topo-wrap`.

### Drag must not select

`.pcb-comp` carries a bare `click` listener, and `selectServer` triggers a full re-render. The controller's `pointerdown` already bails on a configurable selector; topology passes `.pcb-comp, .mcu, .canvas-controls, .minimap`.

## Risks / Trade-offs

- **Refactoring code that shipped an hour ago** → The roadmap's spec is now 19 requirements and is the regression contract; every one of its navigation scenarios is re-checked against the extracted controller before the topology work is judged. The extraction lands as its own task group so a regression bisects cleanly.
- **Growth changes an established look at scale** → Below the threshold the layout is pixel-identical to today, because the bank is centred while it still fits. Only boards that would previously have overlapped move.
- **Traces are drawn in canvas units** → `stroke-width`, `stroke-dasharray` and the `r=3.5` solder pads all scale with zoom: coarse at 2×, sub-pixel at 0.25×. Same trade-off the roadmap's edges already accepted; noted, not mitigated.
- **`lm-dash` animation under a scaled parent** → each frame repaints the composited layer. Mitigated the same way as the roadmap: `will-change: transform` only for the duration of a drag.
- **Selection ring scales** → `.pcb-comp.selected`'s 2px ring becomes 0.5px at minimum zoom, as `.gcard.selected` already does.
- **The topology re-renders on far more events than the roadmap** (scope, selection, close, check start, check error, two WS message types) → viewport survival has more paths to get wrong here, so it is verified per trigger rather than as a single case.
- **No test suite** → verification is a measured manual checklist, as in `roadmap-canvas-navigation`.

## Migration Plan

Frontend-only, no daemon or data changes, no persisted state. Sequenced so each step is independently checkable: extract the controller and re-verify the roadmap unchanged → grow the topology layout → convert the topology to a canvas. Rollback is `git revert`; nothing outside `public/` changes.

## Open Questions

- The exact `PITCH`. It must exceed the ~56px card height with visible separation; the roadmap's analogous `V_SPACE` is 170 for 128–187px cards, a ratio that would suggest roughly 75–80px here. To be settled by measuring a synthetic 24-server board.
- Whether the minimap should mark liveness state per server, or stay a plain structural overview. Starting plain, matching the roadmap's uniform card rects; the recency/state colouring can follow if the overview reads as ambiguous.
- Whether the base canvas should stay 1200 wide once the height is dynamic, or narrow when the window is narrow. Starting fixed at 1200, since the two bank columns and the hub are all positioned against it.
