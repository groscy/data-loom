## Why

The topology's trace routing has the same defect the vertical layout just had: a fixed pitch with no floor. Each trace turns at its own vertical channel, placed at `452 − i × 22` for the left bank (mirrored right), and nothing stops that walking out of the corridor it is supposed to occupy.

The corridor between the hub chip edge (x=524) and the card column edge (x=346) is 178px wide. At the fixed 22px pitch it is exhausted after five traces:

| bank index | channel x | what happens |
| --- | --- | --- |
| 0–4 | 452 → 364 | correct |
| 5 | 342 | the final leg **doubles back** — the channel is past the card edge |
| 14 | 144 | the vertical run is **left of the card column**, crossing behind every card |
| 21 | −10 | the trace is drawn **outside the viewBox** |

`topology-canvas-navigation` fixed the vertical compression and named this as an explicit non-goal, because growing the canvas neither caused it nor fixed it. But that change made the topology usable at counts where this is plainly visible: a board large enough to need the minimap is a board whose traces double back.

## What Changes

- Cap the channel pitch so every routing channel stays inside the corridor between the chip edge and the card column. The pitch stays at its preferred 22px while it fits and compresses only once it would not — the same shape as the vertical pitch floor, from the other direction.
- **No visual change below 6 servers per bank** (12 total): the channels keep their current positions exactly.

Out of scope: the two-bank arrangement, the pin fan on the chip, and the orthogonal three-segment trace shape. Only the channel's x position changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `topology-view`:
  - **Added** — a requirement that a connection is routed within the corridor between the hub and the card column: it never doubles back, never runs behind the cards, and never leaves the canvas, at any server count.

## Impact

- [`public/app.js`](public/app.js) — `renderTopology()`: derive the channel pitch from the corridor width and the bank size instead of hardcoding 22; add the three routing constants beside the existing topology geometry.
- No CSS or markup changes. No daemon, discovery, API, or MCP changes.
