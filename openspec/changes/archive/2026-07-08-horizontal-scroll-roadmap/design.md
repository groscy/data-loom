## Context

The roadmap graph is drawn on a **fixed design canvas** in [`public/app.js`](../../../public/app.js). `renderBoard` distributes phase columns evenly across a constant total width:

```js
const G_MX = 150, G_W = 1180;              // margins + fixed canvas width
const span = (G_W - 2 * G_MX) / Math.max(phaseNums.length - 1, 1);
const gx = (p) => G_MX + phaseNums.indexOf(p) * span;   // phase → x center
```

Phase frames (`.board`/`.phase-frame`, fixed **234px**) and change cards (fixed **210px**) are positioned centered on `gx(p)`. Because the total width is constant, `span` shrinks as phases grow: at 3 phases `span ≈ 440px`, at 5 `≈ 220px`, at 9 `≈ 110px`. Once `span` drops below the frame/card width the columns collide — the reported case (`cortex_stack`, 9 phases) overlaps and clips card titles. `.board` is hard-coded `width: 1180px; margin: 0 auto` and the `#edges` SVG viewBox is fixed to `1180 × H`, so nothing overflows — the content is crushed to fit instead.

The `main` element already scrolls (`overflow: auto`); the vertical axis already grows the canvas (`canvasH`) so tall phases fit. Only the horizontal axis is pinned.

## Goals / Non-Goals

**Goals:**
- Phase columns keep a **fixed horizontal footprint** independent of phase count; no overlap or clipping at any depth.
- The roadmap **scrolls horizontally** when it is wider than the viewport, and stays **centered with no scrollbar** when it fits.
- Dependency edges stay correctly aligned across the full (possibly scrolled) width.
- Change stays entirely client-side, symmetrical with how the vertical axis already grows.

**Non-Goals:**
- No change to the daemon, phase derivation, roadmap model, or websocket protocol.
- The MCP **topology** view (its own fixed `1200 × 640` canvas) is untouched — separate concern, deferred.
- No new scroll affordances beyond a native scrollbar (edge-fade / drag-to-pan are possible later polish, out of scope).
- No re-orientation to vertical bands — the horizontal-column layout is the target (see the retired spec requirement).

## Decisions

### Decision 1: Fixed per-phase spacing → canvas width grows with phase count
Replace the "divide a constant width by N" formula with a constant per-phase spacing, so the canvas width becomes a function of phase count instead of the other way around:

```js
const PHASE_SPAN = 260;                                  // fixed column pitch
const canvasW = 2 * G_MX + Math.max(phaseNums.length - 1, 0) * PHASE_SPAN;
const gx = (p) => G_MX + phaseNums.indexOf(p) * PHASE_SPAN;
```

`PHASE_SPAN = 260` = the 234px frame width + a ~26px gutter, i.e. the minimum pitch that guarantees adjacent frames never touch. It is a single tunable constant. `gx`, card positions, and frame positions (`gx(p) - 117`) are otherwise unchanged, so intra-phase vertical stacking, card sizing, and the frame/card centering all carry over untouched.

`G_W` (the old 1180 constant) is no longer used for layout and can be removed.

**Alternative — CSS grid / flexbox with min-width columns:** rewrite the absolute-positioned canvas as a flow layout. Rejected: the graph relies on absolute coordinates for the SVG dependency edges (`gx`/`pos`), so a flow rewrite would force reworking edge routing too — far larger blast radius than this bug warrants.

**Alternative — keep dividing but clamp `span` to a minimum:** `span = max(MIN, (G_W-…)/(n-1))`. This is effectively the same as a fixed pitch once clamped, but keeps a redundant `G_W` and an awkward "stretch until N, then fixed" seam. A single fixed pitch is simpler and behaves consistently at every phase count.

### Decision 2: Size `#board` and the edges viewBox to the computed width
Mirror the existing dynamic-height code (`board.style.height = canvasH`). Set the width and the SVG user-space to the same computed `canvasW`:

```js
board.style.width  = canvasW + "px";
board.style.height = canvasH + "px";
edgesSvg.setAttribute("viewBox", `0 0 ${canvasW} ${canvasH}`);
```

The edges SVG is `width:100%; height:100%` of `.board`, so a viewBox equal to the board's pixel size keeps edge user-units at 1:1 with card pixels — `drawEdges` (which already works in `gx`/`pos` canvas units) needs **no** coordinate changes. In CSS, drop the hard-coded `width: 1180px` from `.board`; it is now supplied by JS.

### Decision 3: Contain the horizontal scroll to the board, not the whole view
Put the horizontal scroll on the `.board-wrap` wrapper (`overflow-x: auto`) rather than on `main`, so only the graph pans — the conflicts/review banners above it stay fixed. `.board` keeps `margin: 0 auto`: when `canvasW` ≤ the wrapper width the auto margins center it (no scrollbar); when `canvasW` exceeds it the auto margins collapse to 0 and the wrapper shows a horizontal scrollbar with nothing clipped. Vertical scrolling remains on `main` as today.

**Alternative — scroll on `main`:** simpler (no wrapper change) but the banners and padding scroll horizontally with the graph, which reads as broken. Rejected.

## Risks / Trade-offs

- **Small plans render more compact/centered than the old stretched look** (a 2–3 phase plan no longer fills 1180px). → Intentional and more consistent — a centered compact graph reads cleanly. If it feels too sparse, a one-line `canvasW = Math.max(FLOOR, …)` floor can be added without touching anything else.
- **Horizontal scrolling relies on a native scrollbar** (mouse-wheel users may need shift+wheel). → Standard browser behavior; contained to the board so it's discoverable. Fade/drag affordances are deferred polish.
- **Tight 26px inter-frame gutter at the chosen pitch.** → Tunable via the single `PHASE_SPAN` constant; raising it trades gutter width for more scrolling.
- **The retired "vertically stacked phase bands" spec requirement.** → It already did not match the shipped horizontal layout; this change reconciles the spec with reality rather than introducing new divergence (see the delta spec's REMOVED section).

## Migration Plan

Pure client-side rendering change in three files (`public/app.js`, `public/style.css`, `public/index.html`). No data migration, no protocol/version bump. Rollback = revert the three files. Verify manually against a many-phase project (e.g. `cortex_stack`, 9 phases): cards no longer overlap, the board scrolls horizontally, and a ≤3-phase project stays centered with no scrollbar.

## Open Questions

- Exact `PHASE_SPAN` value — `260` is the proposed default (min non-overlap pitch); final value is a visual-tuning call during implementation.
- Should the topology view get the same treatment? Deferred to a separate change; flagged here so it isn't forgotten.
