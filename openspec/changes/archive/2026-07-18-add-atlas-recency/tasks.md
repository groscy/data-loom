## 1. Overlay data + marking

- [x] 1.1 On atlas render, read each capability's and requirement's provenance dates from the `AtlasModel`, and read `lastSeenAt` from `localStorage` (seed to now on first visit — see 3.1)
- [x] 1.2 Mark building blocks, their enclosing groups, and the individual requirements whose last-changed date is at/after `lastSeenAt`; render **newly-introduced** distinctly from **modified** at both levels
- [x] 1.3 Compare the day-granular archive date against the timestamp cursor by a single documented rule (archive date = start-of-day instant) so a same-day change is not perpetually re-flagged

## 2. Recency-driven disclosure + summary

- [x] 2.1 Expand requirements marked as changed by default and keep unchanged ones collapsed to their titles (extends the building-block page's on-demand outline from `add-system-atlas`)
- [x] 2.2 Render a top-of-atlas summary ("N changed since your last visit") that links directly to the changed building blocks and requirements

## 3. Clearing + persistence

- [x] 3.1 Persist `lastSeenAt` in `localStorage`; on first visit (no value) seed it to now so existing content is not shown as stale; never write it to the workspace
- [x] 3.2 Advance `lastSeenAt` when the atlas is viewed, and add an explicit "mark all read" control that advances it and clears the marks; cleared state survives a reload
- [x] 3.3 Style marks in `public/style.css` (new vs modified treatment) and the summary bar

## 4. Verification

- [x] 4.1 Fresh `localStorage`: confirm the first visit marks nothing (baseline seeded to now)
- [x] 4.2 Set `lastSeenAt` back in time: confirm the capabilities **and the specific requirements** touched after it are marked (new vs modified distinguished), the summary links to them, and the changed requirements are expanded by default (e.g. `Node detail inspection` on `roadmap-view`)
- [x] 4.3 Confirm "mark all read" and viewing both clear the marks, and that the cleared state survives a reload
- [x] 4.4 With nothing archived since `lastSeenAt`, confirm nothing is marked (no false positives) and the page reads clean
