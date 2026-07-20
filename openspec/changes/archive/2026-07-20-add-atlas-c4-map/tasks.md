## 1. Derive capability relations (daemon)

- [x] 1.1 Add `AtlasRelation { a, b, weight, changes }` to [`src/types.ts`](src/types.ts) beside the other atlas types, and add `relations: AtlasRelation[]` to `AtlasModel` with a doc comment stating that it is co-change coupling, not dependency
- [x] 1.2 Add `deriveRelations(decisions)` to [`src/atlas.ts`](src/atlas.ts): for each archived change, take the pairs of its `capabilities`, key each pair by its two names sorted, and accumulate weight plus the contributing change names
- [x] 1.3 Apply the fan-out bound in `deriveRelations` — skip any change touching more than `REL_MAX_FANOUT = 4` capabilities — with a comment explaining that a sweeping change couples everything and carries no signal
- [x] 1.4 Return the relations sorted deterministically (weight desc, then `a`, then `b`) from `deriveAtlas`, so successive renders of an unchanged workspace are byte-identical
- [x] 1.5 `npm run build` — verify `tsc` passes with no new errors

## 2. Map shell: markup, layout rules, and the third canvas controller

- [x] 2.1 In [`public/index.html`](public/index.html), restructure `#atlas` into a breadcrumb bar, a `canvas-viewport` (layer + `.edges` SVG + `canvas-controls` + `minimap`, copying the roadmap's exact structure and its `role="application"` / `aria-label` navigation hint), and the existing `#atlas-body` as a sibling document pane
- [x] 2.2 In [`public/style.css`](public/style.css), add `#atlas.active` to the `#roadmap.active, #topology.active` flex-column rule (l. 296), and give the document pane `flex: 1; min-height: 0; overflow: auto` so it owns its scrolling instead of `main`
- [x] 2.3 Add the `.atlas-map-*` / `.amap-*` rules: node, node label, node meta, boundary, breadcrumb, and the `new` / `mod` recency treatments — all colours from the existing CSS variables so light and dark both work
- [x] 2.4 Create the third `createCanvasController` instance in [`public/app.js`](public/app.js) with `dragIgnoreSelector: ".amap-node, .canvas-controls, .minimap"`, `shouldShowMinimap: (cw, ch, vw, vh) => cw > vw || ch > vh`, and `onReveal: () => { if (atlas) renderAtlasMap(); }`
- [x] 2.5 Add the layout constants block (`A_NODE_W`, `A_NODE_H`, `A_GAP_X`, `A_GAP_Y`, `A_PAD`, `A_BOUND_PAD`, `A_MAX_COLS`) next to the roadmap and topology constant blocks, following their commenting style

## 3. The three levels

- [x] 3.1 Add the focus state (`atlasMapLevel`, `atlasMapGroup`, `atlasMapBlock`) to the module-level bindings, plus `gridLayout(n)` returning column count and canvas size from the constants
- [x] 3.2 Implement `renderAtlasMap()`: clear the layer, dispatch on level, place absolutely-positioned nodes, set the canvas size, then `setCanvasSize` → `renderMinimap` → `markUnfitted` → `settle` in that order
- [x] 3.3 L1 (system): one node per `atlas.groups` entry — group key, block count, recency mark — sorted by block count desc then key, inside a system boundary framed by the overview
- [x] 3.4 L2 (domain): one node per block in the focused group — capability name, requirement count, recency mark — plus an affordance on each node to open its documentation directly
- [x] 3.5 L3 (capability): one node per requirement of the focused block — requirement title, scenario count, recency mark
- [x] 3.6 Wire node activation to descend a level, and make nodes keyboard-activatable (focusable, Enter/Space) rather than click-only
- [x] 3.7 Add `groupMark(g)` beside the existing `markOf` / `blockMark` — `"new"` when every block is new, else `"mod"` when any block or requirement is marked — and paint the marks on nodes at all three levels
- [x] 3.8 Implement `drawAtlasMinimap()` emitting node rects in canvas coordinates with the focused node marked `.sel`, reusing the existing `.mm-card` / `.mm-card.sel` classes

## 4. Breadcrumb, handoff, and back

- [x] 4.1 Render the breadcrumb trail from the focus state; each ancestor entry returns to that level
- [x] 4.2 Bind `Escape` on the map viewport to ascend exactly one level, and make sure it does not fire when focus is inside the document pane
- [x] 4.3 Implement the handoff: switch to the document pane, call the existing `scrollToBlock(name)`, and when a requirement was targeted, open its `<details>` (triggering the existing `lazyBody` build) and scroll it into view
- [x] 4.4 Add the document pane's "back to map" control, returning to the level the user left
- [x] 4.5 On a live `atlas` push, keep the focus if the focused group and block still exist in the new model, otherwise fall back to L1

## 5. Relations on the map

- [x] 5.1 Draw L2 edges between block nodes from `atlas.relations`, as cubic Béziers in the `.edges` overlay in canvas units, with `stroke-width = 1.2 + min(weight, 5) * 0.5` and **no** arrow marker
- [x] 5.2 Aggregate relations to group level for L1: sum the weights of relations whose two capabilities fall in different groups, and draw one edge per group pair
- [x] 5.3 Add the hover description — "changed together in N changes" naming the changes — as an SVG `<title>`, never the word "depends"
- [x] 5.4 Omit the relations legend entirely when `atlas.relations` is empty, and confirm a workspace with no archive still renders its nodes

## 6. Documentation

- [x] 6.1 Update [`ARCHITECTURE.md`](ARCHITECTURE.md): the SPA is no longer just "a roadmap tab and an MCP topology tab" (l. 28 and l. 58), and `src/atlas.ts` is missing from the module map entirely — add both, and note the atlas map as the third canvas
- [x] 6.2 Update the atlas mention in [`README.md`](README.md) to say the atlas opens on a navigable map

## 7. Verification (manual — this repo has no automated tests)

- [x] 7.1 **Run `npm run sync-global` first.** A globally installed daemon serves `public/` relative to `dist/`, so none of the checks below test your changes until this runs
- [x] 7.2 Levels: from the atlas tab, drill L1 → L2 → L3 → document and back up via the breadcrumb; confirm each level opens fitted and centred, and that `Escape` ascends exactly one level
- [x] 7.3 **The scroll-container regression check** (the highest-risk item in the design): in the document pane confirm scrolling works, `scrollToBlock` still scrolls-and-flashes, the recency chips still jump, and a `<details>` still lazily builds its body — on both a one-requirement capability and a nine-requirement one
- [x] 7.4 Handoff: activating a requirement node lands on the document at the right block with that requirement expanded, including a requirement *not* marked as changed
- [x] 7.5 Navigation contract: drag-pan, wheel-pan, ctrl+wheel zoom, the three on-screen controls, and arrows / `+` / `-` / `0` from the keyboard — on every level
- [x] 7.6 Minimap: appears when a level outruns the viewport, hidden when it fits, click and drag both jump the viewport, focused node reads as selected
- [x] 7.7 Hidden-tab trap: reload with the roadmap selected, wait for the atlas model to arrive, then switch to the atlas — the map must be laid out and fitted, not collapsed or unfitted
- [x] 7.8 Recency: with a stale `dataloom-atlas-seen:<project>` value, confirm marks appear at all three levels with new distinguished from modified; then "mark all read" in the document clears the map's marks too, and the cleared state survives a reload
- [x] 7.9 Relations: hover an L2 edge and confirm the wording is "changed together", that thicker edges correspond to higher weight, and that L1 edges only appear between different groups
- [x] 7.10 Live push: archive or edit a spec while the map is open and confirm it re-renders with focus preserved; then rename the focused capability and confirm it falls back to L1 instead of stranding
- [x] 7.11 Empty and degenerate states: a project with no settled capabilities (empty state, no canvas), a project with no archive (nodes, no edges, no legend), and a singleton group containing one block
- [x] 7.12 Both themes at a narrow and a wide window, confirming no horizontal overflow and legible contrast on nodes, edges and marks — *themes and overflow verified at 1280px; window resizing is not verifiable in the in-app browser pane (see notes)*

## Verification notes

Run against the real daemon at `127.0.0.1:4317` with `npm run sync-global` applied, driving the
page with measured assertions (transforms via `DOMMatrix`, `getBoundingClientRect`, computed
styles) rather than screenshots. Everything in group 7 passed. Highlights worth keeping:

- Each level fits exactly on arrival — L1 at `k = 0.898` (688 × 0.898 = 617 = viewport height),
  centred at `x = 126.2`, matching the computed fit to the pixel.
- Edge weights render as specified: the weight-4 `roadmap-derivation ↔ roadmap-view` edge draws at
  `stroke-width 3.20`, weight-1 edges at `1.70`, and no path carries a `marker-end`.
- The scroll-container change is sound: `#atlas-doc` scrolls (9903 / 617, `overflow-y: auto`) and
  `main` no longer does (662 = 662), with no double scrollbar.
- A same-level live push preserves the reader's pan exactly; a renamed or removed focus falls back
  to the system level.
- A real spec-file touch drove watcher → recompute → WebSocket → re-render with focus intact.

Three things the in-app browser pane cannot exercise. All were confirmed to be the environment,
not the code, and should be eyeballed once in a real browser:

- **`scrollIntoView({behavior: "smooth"})` does not run** there (`scrollTop` stays 0), so the
  landing animation is unverified. Targeting was proven with `behavior: "auto"`: the handoff scrolls
  to 5207 and leaves the requirement 127px from the pane top. This affects the pre-existing
  `scrollToBlock`/`scrollToDecision` identically, so it is not new to this change.
- **CSS transitions freeze mid-flight**, which made a themed node border read as the light value
  after switching to dark. With `transition: none` both themes resolve `--border2` correctly
  (`#27496f` dark, `#b6c7e4` light) — a frozen animation, not a styling bug.
- **`ResizeObserver` never fires and screenshots time out**, so live window resizing and visual
  appearance are unverified. The reveal path was proven instead by driving the tab click directly:
  a map first rendered against a 0×0 viewport fits correctly on reveal.
