## 1. Band layout

- [x] 1.1 Restructure `renderBoard` to emit one `.phase-band` per phase, stacked vertically (earliest on top), each with a phase label and a `.phase-band-cards` row of cards
- [x] 1.2 Insert a downward phase-progression arrow between consecutive bands
- [x] 1.3 CSS: `.board` as a vertical stack; `.phase-band` dashed rounded container; `.phase-band-cards` wrapping row; the progression arrow

## 2. Dependency arrows

- [x] 2.1 Adapt `drawEdges` to the band layout (measure card rects in the new positions) and render dependency connectors dashed, distinct from the solid phase-progression arrows
- [x] 2.2 Re-run edge drawing after render and on resize (keep existing wiring)

## 3. Preserve the rest

- [x] 3.1 Keep status/readiness badges, the next-up ring, the conflict treatment, the conflicts banner, the project selector, and the archived done-band working in the new layout

## 4. Verification

- [x] 4.1 With multiple phases, confirm phases stack top-to-bottom as bands with cards in rows and a downward arrow between bands
- [x] 4.2 Confirm a cross-phase dependency draws a connector between the two cards
- [x] 4.3 Confirm badges, conflicts, the selector, and the done-band still render correctly
