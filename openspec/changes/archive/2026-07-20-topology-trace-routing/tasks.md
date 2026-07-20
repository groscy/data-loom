## 1. Bound the routing channels

- [x] 1.1 Add `CH_BASE` (first channel's offset from the chip edge, 72), `CH_STEP` (preferred spacing, 22) and `CH_MARGIN` (clearance from the card column, 16) beside the existing topology geometry constants.
- [x] 1.2 Derive the corridor width from the layout constants (`PCB_CX − CHW / 2 − LEFT_PAD`) rather than writing 178, so moving a bank column or resizing the chip cannot silently reintroduce the bug. — resolves to 178, giving 90px of usable channel span after the base offset and margin.
- [x] 1.3 Replace the hardcoded `452 − i × 22` / `748 + i × 22` with `chipEdge ∓ (CH_BASE + i × step)`, where `step = min(CH_STEP, usable / max(n − 1, 1))`, computed per bank from that bank's length.

## 2. Verification

Frontend-only, so verify against a local daemon built from this repo. Real configs here have 3 servers, so the failing counts need a synthetic model injected client-side via `setMcp()`. Record measured values.

Verified against a local daemon on port 4318, parsing the rendered `d` attribute of every trace rather than re-deriving positions in the test.

- [x] 2.1 Corridor containment: swept **1–40 servers, 0 violations**. Every channel lands in [362, 452] on the left and [748, 838] on the right — strictly inside the 346→524 and 676→854 corridors.
- [x] 2.2 Final segment direction: **0 reversals** across the sweep (left `midX > padX`, right `midX < padX` throughout). The old formula reversed from bank index 5.
- [x] 2.3 Nothing behind the cards and nothing off-canvas: **0 violations** across the sweep. The old formula put the vertical run inside the card column from index 5, left of it from 14, and off-canvas from 21.
- [x] 2.4 Unchanged below the crossover — verified by reproducing the old formula and diffing channel-by-channel: **identical for n = 1…10** (`identicalWhereOldWasLegal: true`), first divergence at **n = 11**, which is precisely the first count where the old formula produced an illegal channel (`divergesOnlyWhereOldWasBroken: true`). Sample compressions: n=11 → 18px step, n=20 → 10px, n=40 → 4.74px, all spanning 452→362.
- [x] 2.5 Endpoints still land exactly: at 30 servers, **worst pad error 0px and worst pin error 0px** — every trace still starts on the chip edge within the pin fan and ends on its card's solder pad.
- [x] 2.6 The real 3-server board is unchanged: `M 524 307 H 452 V 72 H 346`, `M 524 333 H 430 V 568 H 346`, `M 676 320 H 748 V 320 H 854` — channels 452/430/748, same as v0.12.0. The roadmap is untouched (no shared code path).
- [x] 2.7 Run `npm run build` and `node --check public/app.js`. — both clean.

Two false alarms during verification, both defects in the test rather than the code, noted so the record is not misleading: a hand-typed "expected paths" literal had the wrong channel for the second left trace, and a first pass counted each live trace twice because `drawTraces` emits a second animated overlay path for reachable links.
