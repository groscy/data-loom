## Context

The atlas is derived by [`src/atlas.ts`](src/atlas.ts) into an `AtlasModel` of three nested levels — `groups[] → blocks[] → requirements[]` — plus a flat, newest-first `decisions[]` list that joins back to blocks by capability name. It renders in [`public/app.js`](public/app.js) (l. 1205–1522) as one scrolling document: a recency bar, the `config.yaml` overview, then every group with every block as a stack of `<details>` elements, plus the decisions section. Navigation inside it is anchor scrolling (`scrollToBlock` → `#atlas-cap-<name>` + a 1200 ms `.flash`).

The other two views are already boards. Both are absolutely-positioned DOM over one inline SVG overlay inside a single transformed layer, driven by `createCanvasController` — a factory closure extracted in `2026-07-20-topology-canvas-navigation` precisely so a third view could not drift from the first two. It owns pan, zoom, fit, clamping, keyboard, the minimap, and the hidden-tab `revalidate`/`onReveal` dance. Its per-view surface is four callbacks.

Two constraints shape everything below. First, the frontend has **no framework, no bundler, no dependencies and no build step** — three static files, vanilla DOM via a six-line `el()` helper. A graph library is not an option. Second, the atlas obeys DataLoom's standing principles: *derived, not stored*; *mechanical, no NLP*; *project-agnostic, no hardcoded taxonomy*; strictly read-only.

The gap this change closes: **the model carries no edges.** Nothing in `AtlasModel` relates one capability to another. `groupByDomain` uses name-prefix affinity, but that is containment, not relation. `add-system-atlas/design.md` considered co-change clustering and deferred it as "more than v1 needs". A C4 diagram without relationships is a treemap, so reviving it is the price of admission.

## Goals / Non-Goals

**Goals:**

- Give the atlas a picture that is the navigation, not an illustration beside it — you get from "the whole system" to "this requirement" by drilling, in three clicks, without scrolling past anything.
- Keep the picture readable as the workspace grows: layout is a function of node count, and the canvas grows rather than the nodes shrinking (the pitch-floor lesson from `topology-trace-routing`).
- Derive capability relations mechanically, from data the model already reads, and be honest in the UI about what those relations mean.
- Reuse `createCanvasController` verbatim. A third instance, four callbacks, zero changes to the controller.
- Leave the atlas document — its lazy bodies, anchors, `<details>` state and recency cursor — working exactly as it does today.

**Non-Goals:**

- **A true dependency graph.** Parsing `src/` for imports would make the atlas language-aware and project-specific, in direct conflict with the mechanical/agnostic principle. Explicitly rejected in the proposal.
- **Continuous semantic zoom.** No level-of-detail crossfade as `k` passes thresholds. Levels are discrete and switched by click.
- **Editing, filtering, or search.** Read-only stands; a search box over the atlas is a separate change.
- **Replacing the document.** Long normative prose reads badly inside a pan/zoom canvas. The document is where reading happens; the map is where finding happens.
- **Touching the roadmap or the topology.** Their canvases and layouts are untouched.

## Decisions

### 1. Four levels, C4 as lineage rather than literal vocabulary

| Level | C4 analogue | Node | Boundary | Drill target |
| --- | --- | --- | --- | --- |
| **L1 System** | System Context | one per domain group | the workspace | L2 |
| **L2 Domain** | Container | one per building block | the opened group | L3 |
| **L3 Capability** | Component | one per requirement | the opened block | the document |
| **L4 Detail** | Code | — | — | the existing atlas document, at that anchor |

C4's canonical names describe deployable software (containers are runnable processes); ours describe specification structure. Borrowing the *ladder* — each level is one node of the level above, opened — is the useful part; borrowing the *nouns* would misdescribe what is on screen. The UI labels each level by what it shows ("System", the group's name, the capability's name) and the breadcrumb carries the trail.

**Alternative considered:** three levels, folding requirements into the document handoff. Rejected — requirement count per capability ranges from 1 to 9 here, and the L3 grid is what makes a large capability scannable before you commit to reading it.

### 2. Discrete levels with a full re-render, each opening fitted

Drilling calls `renderAtlasMap()` again with new focus state. The controller is told `markUnfitted()` then `settle()`, so every level opens fitted-and-centered rather than inheriting the previous level's pan — the arriving level has a different canvas size, and inherited `{x, y, k}` would land the reader somewhere arbitrary. Within a level, pan/zoom persists across live model pushes exactly as it does on the other two boards (the `view` state lives in the controller closure, outside the DOM the render destroys).

Focus state is three module-level `let` bindings alongside the existing ones (`atlasMapLevel`, `atlasMapGroup`, `atlasMapBlock`) — the SPA's established pattern. It is **not** persisted: on a live `atlas` push, focus is kept if the focused group/block still exists in the new model and otherwise falls back to L1, so an archived rename cannot strand the view on a dead node.

**Alternative considered:** semantic zoom, where `k` thresholds swap detail. Rejected — it fights the fit-on-open behaviour, makes "which level am I on" ambiguous mid-gesture, and the controller has no hook for it.

### 3. Deterministic grid layout, never force-directed

Nodes are sorted (blocks by requirement count desc, then name; groups by block count desc, then key) and placed into a grid of `cols = ceil(sqrt(n))`, clamped to a max column count so the canvas grows downward rather than becoming a letterbox. Constants follow the existing convention of a named block at the top of the section:

```
A_NODE_W = 208   A_NODE_H = 92    A_GAP_X = 56   A_GAP_Y = 44
A_PAD    = 72    A_BOUND_PAD = 36                A_MAX_COLS = 5
canvasW = 2*A_PAD + cols*A_NODE_W + (cols-1)*A_GAP_X
canvasH = max(420, 2*A_PAD + rows*A_NODE_H + (rows-1)*A_GAP_Y)
```

Force-directed layout is rejected on three counts: it needs a library or a hand-rolled simulation, it is non-deterministic so the same workspace draws differently each render, and it jitters on every live push. The roadmap's fixed `gx(phase)` columns and the topology's fixed banks are the precedent — both are pure functions of the model, and both are stable under re-render. Node size is fixed and the canvas grows, which is the same choice `topology-trace-routing` made with `pitchOf`.

### 4. Relations from co-change coupling, derived in the daemon

Two capabilities are coupled when an archived change touched both. The weight is the number of such changes, and each edge carries the change names that produced it so the UI can say why.

```ts
interface AtlasRelation { a: string; b: string; weight: number; changes: string[] }
// AtlasModel gains: relations: AtlasRelation[]
```

Derived in `atlas.ts` from the already-assembled `decisions[].capabilities` — no new file reads, no new parsing, no new dependency. Two rules keep it meaningful:

- **Fan-out cap.** A change touching more than `REL_MAX_FANOUT = 4` capabilities is skipped. A sweeping refactor couples everything to everything; the resulting clique is noise that would bury the real signal. (In this repo the cap excludes almost nothing — most archived changes touch one or two capabilities — but it is what keeps the map honest on a workspace with a big-bang change in its history.)
- **Undirected, deduped.** The pair is keyed by sorted names, so `(a,b)` and `(b,a)` are one edge. Co-change carries no direction, so the SVG draws **no arrowhead** — deliberately distinct from the roadmap's dashed, arrowed dependency edges, which do mean "after".

At L1 the block-level edges are aggregated to group-level by summing the weights of edges whose endpoints fall in different groups; within-group edges are not drawn at L1 (they are what L2 is for). L3 has no edges — requirement-level coupling is not derivable from the archive, whose deltas are per-capability.

**Alternative considered:** compute this in the browser from `decisions[].capabilities`, which is already on the wire. Rejected — the daemon is the single source of derived truth, the frontend is not typechecked, and a derivation rule that is part of the spec contract belongs in `atlas-derivation` where it can be stated as a requirement.

**Rendering it honestly** matters as much as deriving it. The edge is labelled "changed together in N changes" on hover, never "depends on". Stroke width scales with weight (`1.2 + min(weight, 5) * 0.5`), drawn as a cubic Bézier in the shared `.edges` overlay, in canvas units at 1:1 like both existing boards.

### 5. The document is a sibling pane, not a separate tab

`#atlas` becomes a flex column holding a breadcrumb bar, the map viewport, and the document pane — one visible at a time. Clicking an L3 requirement node (or the "open document" affordance on an L2 block) switches to the document pane, calls the existing `scrollToBlock(name)`, and opens that requirement's `<details>`. The breadcrumb's back control returns to the map at the level you left, and `Escape` climbs one level.

This forces one CSS change with a real risk attached: `#atlas.active` currently inherits `main { overflow: auto }`, so the document scrolls the page. It must join the `#roadmap.active, #topology.active` flex rule (`style.css` l. 296) and the document pane itself takes `flex: 1; min-height: 0; overflow: auto`. `scrollIntoView` resolves against the nearest scrollable ancestor, so `scrollToBlock` and its `.flash` keep working — but this is the single most likely thing to break silently, and the verification checklist calls it out explicitly.

**Alternative considered:** a fourth top-level tab for the map. Rejected — it splits one subject across two tabs and makes the handoff a tab switch rather than a drill, losing the breadcrumb trail that makes the ladder legible.

### 6. Recency rides along unchanged

`markOf` / `blockMark` already compute `null | "new" | "mod"` from provenance against the `dataloom-atlas-seen:<project>` cursor. The map adds one function — `groupMark(g)` = `"new"` if every block is new, else `"mod"` if any block or requirement is marked — and paints nodes with the same two-state treatment the document uses. The existing recency bar stays on the document and gains nothing; the map's marks are the at-a-glance answer, the bar remains the itemised one. `enterAtlas()` still fires on tab entry, so the cursor semantics are untouched.

### 7. Minimap and controls: the standard four callbacks

```
viewport: atlasMapWrap, canvas: atlasMapLayer, minimap: atlasMinimap, minimapSvg: …
dragIgnoreSelector: ".amap-node, .canvas-controls, .minimap"
shouldShowMinimap: (cw, ch, vw, vh) => cw > vw || ch > vh
drawMinimapContent: () => node rects in canvas coordinates, focused node marked `.sel`
onReveal: () => { if (atlas) renderAtlasMap(); }
```

`onReveal` re-renders rather than merely fitting, matching the roadmap: the atlas tab can be `display: none` when its model arrives, and a board first rendered against a 0×0 viewport is neither fitted nor able to judge its own minimap. Controls and minimap sit bottom-left, siblings of the layer (never inside it — anything inside gets scaled).

## Risks / Trade-offs

- **Co-change is correlation, not dependency.** Two capabilities can be coupled because one change happened to touch both for unrelated reasons. → Mitigated by the fan-out cap, by labelling edges "changed together in N changes" rather than implying causation, and by drawing them without arrowheads so they cannot be misread as the roadmap's ordering edges. The map is navigable with zero edges, so a misleading edge is cosmetic, not structural.
- **A young workspace has an empty archive**, hence no relations at all. → That is a correct degenerate state, not a bug: the map renders as pure containment and the relations legend is omitted, consistent with the atlas's "only populated sections render" rule. Worth stating in the spec so it is not treated as a defect later.
- **The `#atlas` scroll-container change can break the document silently** — anchor scrolling, the `.flash` highlight, and `<details>` toggling all currently assume `main` scrolls. → The verification checklist tests scroll-to-block, the recency chips, and lazy body expansion explicitly after the CSS change, on both a short and a long capability.
- **The atlas payload grows.** Relations add roughly one small object per coupled pair (tens, not thousands) to a payload that already carries every spec and every `design.md`. → Negligible relative to what is already on the wire; no pagination or lazy transport needed.
- **A globally-installed daemon serves a stale SPA.** `src/assets.ts` resolves `public/` relative to `dist/`, so frontend changes are invisible until `npm run sync-global`. This has bitten UI verification in both prior canvas changes. → First line of the verification checklist.
- **No automated tests exist in this repo** (CI is `npm ci` + `tsc`; `public/app.js` is not even typechecked). → Follow the precedent set by both canvas changes: a measured, itemised manual checklist in `tasks.md`, with the pan/zoom/fit/minimap/keyboard contract tested the same way the other two boards were.
- **Fifteen groups at L1 is a comfortable grid; a workspace with eighty capabilities is not.** → The grid grows the canvas rather than shrinking nodes, and pan/zoom/minimap is exactly the navigation for that case — the same bet the roadmap makes. If it proves insufficient, grouping-within-grouping is a follow-on change, not a v1 requirement.
