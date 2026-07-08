## 1. Canvas geometry (public/app.js)

- [x] 1.1 In `renderBoard`, add a fixed `PHASE_SPAN` constant (≈260 = 234px frame + gutter) and compute `canvasW = 2 * G_MX + Math.max(phaseNums.length - 1, 0) * PHASE_SPAN`.
- [x] 1.2 Replace the width-derived `span` with `PHASE_SPAN` in `gx` (`gx = (p) => G_MX + phaseNums.indexOf(p) * PHASE_SPAN`); remove the now-unused `span` line and the `G_W` constant.
- [x] 1.3 Set `board.style.width = canvasW + "px"` alongside the existing `board.style.height`, and set the `#edges` viewBox to `0 0 ${canvasW} ${canvasH}` (was `G_W`).
- [x] 1.4 Confirm phase-frame positions (`gx(p) - 117`), card positions (`x - N_HALF`), and `drawEdges` need no further coordinate changes (they read `gx`/`pos` in canvas units).

## 2. Scroll container and styling (public/style.css, public/index.html)

- [x] 2.1 Remove the hard-coded `width: 1180px` from `.board` (width now comes from JS); keep `margin: 0 auto` for centering-when-fits.
- [x] 2.2 Add `overflow-x: auto` to `.board-wrap` so only the graph pans while the conflicts/review banners stay fixed; keep vertical scroll on `main`.
- [x] 2.3 Confirm `public/index.html` needs no structural change (the existing `.board-wrap` > `#board` > `#edges` nesting is sufficient); adjust only if a dedicated scroll wrapper proves necessary.

## 3. Verification

- [x] 3.1 Load a many-phase project (e.g. `cortex_stack`, 9 phases): phase frames and cards no longer overlap or clip, and the board scrolls horizontally to reach the last phase. — verified: board 2380px, `overflow-x: auto`, scrollWidth 2380 > 1156, 26px gutter between every adjacent frame, no overlap, full titles legible.
- [x] 3.2 Load a small plan (≤3 phases): the roadmap is centered with no horizontal scrollbar. — verified: single-phase board 300px, equal 428px margins (centered), not scrollable.
- [x] 3.3 With a wide roadmap, confirm dependency edges connect the correct cards at their actual positions across the full scrollable width (scroll and spot-check a cross-phase dependency). — verified: edges viewBox `0 0 2380 680` matches board 1:1; cross-phase connectors align with their cards when scrolled to either end.
- [x] 3.4 Confirm vertical growth still works: a phase with many stacked cards still grows the canvas height and remains fully visible. — verified: cortex_stack phase with 3 stacked cards grows canvasH to 680 with all cards visible.
