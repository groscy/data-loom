## Why

The System Atlas ([`add-system-atlas`](../add-system-atlas/proposal.md)) makes the whole system browsable and shows each requirement's **provenance** — which change introduced or last-changed it, and when. But that provenance is *absolute*: it tells you a requirement changed on `07-11`, not whether that is new **to you**. Someone who checks the atlas every week still has to scan every date to find what moved since they last looked, across 19 capabilities and their requirements.

The dated provenance is already in the model — what's missing is a **personal cursor** ("since *I* last visited") and a way to make the new parts jump out instead of hiding in the outline. This is the second half of the original request: *"mark changed sections so the user can quickly find their way to the new parts."*

## What Changes

- The atlas gains a **since-last-visit overlay**. Using the per-requirement provenance the atlas already serves, it marks the building blocks, their groups, and the individual requirements whose last change is **after** the viewer's last visit — distinguishing **newly-introduced** from **modified** at both levels.
- The building-block page becomes **recency-driven**: requirements changed since the last visit are **expanded by default** while unchanged ones stay collapsed to their titles, so the reader lands on the new material. On a 16-requirement page, the one changed requirement is what opens.
- A top-of-atlas **summary** ("N changed since your last visit") links straight to the changed blocks and requirements.
- The last-visit reference is **persisted locally** to the browser (`localStorage`) — per-viewer UI state, never written to the workspace. Viewing the atlas advances it, and an explicit **"mark all read"** clears the marks. The **first visit** seeds the baseline to "now", so a new user sees nothing marked as stale rather than a wall of dots.
- **No new daemon data, endpoint, or dependency.** The overlay is a pure `atlas-view` enhancement that reads the provenance dates already in the `AtlasModel` and compares them to the local cursor.

## Depends On

- add-system-atlas

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `atlas-view`: adds a since-last-visit recency overlay — marks changed capabilities and the specific requirements within them (new vs modified), summarizes and links to them, and makes the building-block page's disclosure recency-driven (changed requirements expanded by default). The last-visit cursor is persisted client-side with an explicit "mark all read", and the first visit seeds a clean baseline. Reads the provenance already in the atlas model; adds no server state.

## Impact

- `public/app.js` — the overlay: read each capability's/requirement's provenance dates from the `AtlasModel`, compare to a `localStorage` `lastSeenAt`, mark blocks/groups/requirements (new vs modified), render the summary + jump links, expand changed requirements by default, advance the cursor on view, and the "mark all read" control with first-visit seeding.
- `public/style.css` — recency-mark treatment (new vs modified) and the summary bar.
- No daemon change: `atlas-derivation` already serves per-requirement provenance in the model; this change rides it. No new endpoint, no new dependency, no persisted server state.
