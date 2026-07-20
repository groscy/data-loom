## Context

The roadmap board is an absolutely-positioned DOM canvas with one inline SVG overlay — no framework, no graph library, no bundler. [`renderBoard()`](public/app.js:215) computes a pixel canvas size from phase count and the tallest phase stack, places `.gcard` divs at absolute `left`/`top`, and hands the resulting position map to [`drawEdges()`](public/app.js:320), which builds Bézier path strings into an SVG whose `viewBox` is exactly the canvas pixel size — SVG user units are 1:1 with card pixels.

Navigation today is native scrollbars only: vertical on `main`, horizontal on `.board-wrap`. There is no transform, no zoom, no pointer handling, and no overview anywhere in `public/`. The predecessor change (`2026-07-08-horizontal-scroll-roadmap`) deliberately deferred exactly this work — its non-goals read "no new scroll affordances beyond a native scrollbar (edge-fade / drag-to-pan are possible later polish)" — and its design records that a grid/flexbox rewrite was **rejected** because SVG edge routing depends on absolute canvas coordinates. That constraint still holds and this design does not disturb it.

Two further facts shape the approach. `renderBoard()` runs a full teardown-and-rebuild on *every* model push **and** on every selection change ([`selectChange`](public/app.js:498) / `closeDetail` both call it), so nothing durable can live in board DOM. And there is no test suite at all — CI is `npm ci` + `npm run build`, `public/app.js` is not even typechecked — so verification is a manual checklist, following the precedent set by the horizontal-scroll change.

## Goals / Non-Goals

**Goals:**

- Remove the archived done band from the roadmap; the Atlas is the single place history is read.
- Navigate the roadmap by pan and zoom inside a clipping viewport, with no scrollbar on either axis.
- Give the reader a whole-plan overview and a way to jump within it — the minimap — whenever the canvas outgrows the viewport.
- Keep the reader's place: pan and zoom survive pushes and selections; only a first render or a project switch refits.
- Stay dependency-free vanilla JS and preserve the absolute-coordinate layout the edge routing depends on.

**Non-Goals:**

- The MCP Topology board. It is a fixed 1200×640 canvas in a wrapper with no overflow at all — it has the same problem and deserves the same treatment, but as its own change sharing this implementation.
- Any change to the daemon, derivation, model shape, HTTP API, or MCP surface. `derive.ts` keeps emitting archived nodes and `atlas.ts` keeps reading the archive directly.
- Persisting the viewport across page reloads. Fitting on load is the desired opening state.
- Dragging cards to reposition them. Layout stays a pure function of the model.
- Minimap thumbnails of card *content*. The minimap shows structure — frames and card rectangles — not readable text.

## Decisions

### Transform the existing `#board` element; do not restructure the layout

`.board-wrap` becomes a clipping viewport (`overflow: hidden`) and `#board` gets `transform: translate(x, y) scale(k)` with `transform-origin: 0 0`. Every child — phase frames, cards, and the edges SVG — is inside `#board`, so all of them pan and zoom together as one composited layer, and edges stay anchored to their cards for free. `renderBoard()`'s geometry math is untouched.

*Alternatives considered.* Transforming only the SVG and repositioning cards in JS would mean recomputing every card's `left`/`top` on each pan frame — more code, worse performance, and two sources of truth for position. Scaling via the SVG `viewBox` alone would not move the HTML cards at all. Native scroll with hidden scrollbar chrome (`::-webkit-scrollbar { display: none }`) would satisfy "no scrollbars" cheaply but gives no zoom, and the minimap would degrade to a position indicator — rejected against the chosen navigation model.

### Viewport state lives in module scope, keyed by project

A single `view = { x, y, k }` plus a `viewFitted` flag sit next to the other client state in `app.js`, outside any DOM that `renderBoard()` destroys. `renderBoard()` ends by re-applying the current transform rather than resetting it, which satisfies viewport survival across both pushes and selections with one line. `setProjects()` clears the state when `p.current` changes, which is what makes a project switch refit while a push does not.

### Fit-to-view computes scale from the canvas size `renderBoard()` already knows

`canvasW`/`canvasH` are computed per render; fit is `k = min(vw / canvasW, vh / canvasH, 1)` centered in the viewport, clamped to the zoom range. The `min(…, 1)` term means a small plan is never magnified — it stays at 1:1 and centered, preserving the existing "narrow roadmap stays centered" behavior rather than blowing three cards up to fill the screen.

### Zoom range 0.25–2, anchored at the pointer

Pointer-anchored zoom is the standard formula: convert the pointer to canvas coordinates, apply the new scale, translate so that canvas point lands back under the pointer. The lower bound is set by the minimap's job — below roughly 0.25 the cards are structure, not content, and the minimap is the better tool. The upper bound of 2 is enough for a comfortable read on a dense display without inviting the canvas to be lost off-screen.

### Pan is clamped so the canvas can never be lost

Translation is clamped to keep a margin of canvas inside the viewport on every edge. Without this, a drag with momentum leaves an empty viewport and no obvious recovery — the fit control exists, but a blank screen is a bad state to have to recover *from*.

### Wheel pans, modifier-wheel and pinch zoom

A bare wheel or two-finger trackpad scroll pans both axes — the gesture readers already expect from a canvas. `Ctrl`/`Cmd` + wheel zooms, which is also what a trackpad pinch reports as. `preventDefault` on these handlers requires `passive: false` listeners and `touch-action: none` on the viewport, or the browser will scroll the page instead.

### The viewport is a flex-sized region, measured with `ResizeObserver`

`main` keeps `overflow: auto` because the Atlas and Topology views need it. `#roadmap.active` becomes a flex column of full height with `min-height: 0`, so the conflicts and review banners keep their natural height above and `.board-wrap` takes the rest via `flex: 1; min-height: 0`. A `ResizeObserver` on the wrapper re-clamps the pan and re-renders the minimap when the window resizes, since the fit and the clamp both depend on viewport size.

The banners are variable-height and may appear or disappear between renders. Deriving the viewport box from a live measurement rather than a constant is what keeps fit honest as they come and go.

### The minimap is one SVG rebuilt from the same position map

The minimap reuses the `pos` map and canvas dimensions `renderBoard()` already produces: one `<rect>` per phase frame, one per card, plus a viewport rectangle. It renders into a small fixed-size SVG with `viewBox="0 0 canvasW canvasH"` and `preserveAspectRatio="xMidYMid meet"`, so the browser does the scaling and the minimap needs no geometry math of its own. The viewport rectangle is updated on every pan/zoom frame by setting four attributes — the rest of the minimap is only rebuilt when the model changes.

Visibility follows the rule that the minimap should carry information: it is shown when `phaseCount > 1 || canvasW > vw || canvasH > vh`. Because part of that test depends on viewport size, it is re-evaluated on resize, not only on render.

The phase-count term was added after the first build was reviewed. A pure overflow test is the theoretically tidy rule, but it made the minimap effectively unreachable in practice: the canvas is `300 + (phases − 1) × 260` wide and never shorter than 600px, so on a maximized 1920×1080 window it takes **seven** phases to overflow horizontally, or a browser window under ~706px tall to overflow vertically. Real plans in this workspace run one to four phases, so the feature was present but never seen. Showing it as soon as there is more than one phase trades a little redundancy at fit for a control that actually exists when the plan has structure to survey.

### Clicking the minimap centers; dragging scrubs

A pointer position inside the minimap maps back to canvas coordinates through the same `viewBox` scale, and the viewport centers there. `pointerdown` + `pointermove` on the minimap gives click-to-jump and drag-to-scrub with one code path.

### Keyboard navigation needs the viewport to be focusable

`.board-wrap` gets `tabindex="0"` and a visible focus ring so it can receive arrow / `+` / `-` / `0`. Without a focusable element, keyboard support would have to hang off `document` and would fight with any other focused control. Fixed step sizes (a fraction of the viewport per arrow press, a fixed ratio per zoom step) keep it predictable.

### The detail panel is left out of the fit calculation

`.detail` is `position: fixed` at 362px and overlays the right of the board. Fitting to the full viewport width means an open panel can cover part of a fitted canvas. Compensating would make fit depend on panel state and cause the canvas to jump whenever a change is selected — a worse experience than a panel that overlaps. The reader can pan, and closing the panel restores the full view.

### Archived-change handling in the detail panel is left in place

With the band gone, nothing on the roadmap can select an archived change, so [`renderChangeDetail`'s](public/app.js:562) "archived" pill branch becomes unreachable. It stays: it is three lines, it is the correct rendering if an archived change is ever selected again, and the `roadmap-view` spec still requires a change with no task list to render without error. Deleting it would trade a real spec guarantee for a cosmetic cleanup.

## Risks / Trade-offs

- **Text at low zoom becomes unreadable** → Accepted and mitigated by design: the lower bound is 0.25, and the minimap exists precisely so zoomed-out navigation does not depend on reading cards. Zooming out is for finding your place, not for reading.
- **Discoverability — a canvas with no scrollbar can read as "stuck"** → The minimap appears exactly when the canvas overflows, which is the same moment the scrollbar used to appear, and the zoom/fit controls are always visible. Both signal that there is more to see.
- **`preventDefault` on wheel can trap the page scroll** → Handlers are bound only to the roadmap viewport, and only the roadmap view uses them. The Atlas and Topology views keep native `main` scrolling untouched.
- **Blurry text during transform on some GPUs** → Snap the translation to whole pixels at `k === 1` and avoid a permanent `will-change: transform` (which forces a texture); apply it only while a drag is in progress.
- **A global daemon serves a stale `public/`** — `src/assets.ts` resolves `public/` relative to `dist/`, so an installed copy will not show these changes until `npm run sync-global` runs. This has bitten UI verification before → it is an explicit step in the verification checklist.
- **No automated tests to catch a regression** → Unavoidable in this repo; mitigated by a measured manual checklist in `tasks.md` that records actual observed values, following the `2026-07-08-horizontal-scroll-roadmap` precedent.
- **Removing the band loses one-click access to archived changes from the roadmap** → Intended. The Atlas gives strictly more: date, rationale, design, and the capabilities each archived change shaped. The proposal's migration note records this.

## Migration Plan

Frontend-only and self-contained — no data migration, no daemon change, no version gate. The done-band DOM, JS, and CSS are removed in one step; the canvas replaces `.board-wrap`'s overflow in another. Rollback is a `git revert`: nothing outside `public/` and three documentation lines changes, and no persisted state is written that an older build would have to understand.

## Open Questions

- ~~Whether the minimap belongs in a fixed corner of the viewport (simplest, may overlap cards) or in a reserved gutter.~~ **Resolved during implementation**: a fixed corner overlay at low opacity that lifts on hover, placed bottom-**left** rather than bottom-right. `.detail` is `position: fixed` against the right edge, so anything in the right corner is covered the moment a change is selected. The controls sit in the same corner, stacked below.
- Whether the fit-on-first-render should also fire when the roadmap tab is re-entered after the reader has been in the Atlas. Starting with no — re-entering a tab and finding your place preserved is the less surprising behavior — but this is worth a look during manual verification.
