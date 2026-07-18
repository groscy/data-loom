## 1. Daemon: read the atlas sources

- [x] 1.1 Add a reader in `src/openspecClient.ts` for the project's `openspec/config.yaml` `context` block (the overview narrative); a missing/empty context returns empty, not an error
- [x] 1.2 Add a reader for settled capabilities from `specs/*/spec.md`: capability name, each `### Requirement:` title + body, and the `#### Scenario:` blocks beneath it (behavior)
- [x] 1.3 Add a reader for decisions from archived changes: each `changes/archive/*/design.md` and the proposal `## Why`, tagged with the change name and its archive date
- [x] 1.4 Derive a per-capability change history: from the dated archive folder names crossed with each proposal's New/Modified capabilities, produce `{ introduced: {change, date}, modified: [{change, date}] }` per capability; a capability no archived change touches yields an empty history
- [x] 1.5 Add a reader for archived spec deltas: for each `changes/archive/*/specs/*/spec.md`, capture the requirement titles under `## ADDED Requirements` and `## MODIFIED Requirements` (tagged with the change name + archive date) — the raw material for requirement-level provenance

## 2. Daemon: assemble + serve the atlas model

- [x] 2.1 Add an `AtlasModel` (+ building block / requirement / decision / history types, including per-requirement provenance) to `src/types.ts`; keep `RoadmapModel` untouched (additive contract)
- [x] 2.2 Assemble the `AtlasModel` in `src/derive.ts` (or a new `src/atlas.ts`) as a pure function of the workspace — overview + building blocks (requirements + scenarios) + decisions + per-capability history
- [x] 2.3 Derive per-requirement provenance: join each settled requirement's title to the ADDED/MODIFIED delta titles from 1.5 → `{ introduced: {change, date}, modified: [{change, date}] }` per requirement; a title matching no delta yields empty provenance (no error)
- [x] 2.4 Confirm `src/watcher.ts` recomputes on edits to `specs/`, `changes/archive/`, and `config.yaml` (extend the watch scope if any is missed)
- [x] 2.5 Serve the model read-only over loopback: add `GET /api/atlas` in `src/server.ts` (or attach it to the existing WebSocket push); the Host/Origin guard must apply unchanged
- [x] 2.6 Tolerant assembly: missing config context → overview omitted; placeholder `Purpose` → block built from requirement titles; a change with no `design.md` → skipped; empty archive → blocks with empty histories, no decisions; a requirement matching no delta → empty provenance — none of these throw

## 3. Frontend: the atlas subpage

- [x] 3.1 Add a third tab (`data-tab="atlas"`) and a matching `<section id="atlas" class="view">` to `public/index.html`; wire it through the existing `syncTabs()` mechanism
- [x] 3.2 Fetch/receive the `AtlasModel` and render only the populated sections (Overview, Building Blocks, Decisions); omit any section whose source is absent
- [x] 3.3 Add a small constrained-markdown renderer in `public/app.js` (headings, bullets, bold, Scenario WHEN/THEN) — no new dependency — and use it for capability and decision prose
- [x] 3.4 Render each building block as an **outline of its requirement titles** that expand on demand to the requirement's normative text and its behavior scenarios — so a 1-requirement capability reads effectively fully-shown and a 16-requirement one stays scannable by title (density-adaptive, no fixed layout)
- [x] 3.5 Show each requirement's **provenance** (introduced / last-changed change + date) and the per-capability **"shaping decisions & history"** section: the archived changes that introduced/modified this capability's requirements, newest first, each expandable to its `Why` + design decisions; link each requirement to its shaping change's entry
- [x] 3.6 Style the atlas in `public/style.css` (section layout, building-block outline + expansion, scenario treatment, shaping-history list, scroll within the view)

## 4. Frontend: domain grouping

- [x] 4.1 Group building blocks by shared name-prefix affinity; capabilities sharing no multi-member prefix stand alone — no hardcoded, project-specific group names
- [x] 4.2 Render the `config.yaml` overview narrative as the framing for the groups (the project's own domain), above the grouped blocks

## 5. Verification

- [x] 5.1 Open the atlas: confirm the Overview (from `config.yaml`), the grouped Building Blocks with requirements + scenarios, and the Decisions section all render, and that absent-source sections are omitted rather than shown empty
- [x] 5.2 Confirm grouping is derived, not hardcoded: `roadmap-*` / `mcp-*` cluster, singletons stand alone, and no DataLoom-specific category names are baked in
- [x] 5.3 Building-block page: open a heavy capability (e.g. `roadmap-view`, 16 requirements) and a light one (e.g. `release-pipeline`, 1) — confirm both read well as an outline, and each requirement's provenance/shaping link resolves to the change that introduced/modified it (e.g. `Node detail inspection` → `show-proposal-tasks`)
- [x] 5.4 Confirm read-only + live: no affordance edits any spec/proposal, and archiving a new change (or editing a spec) updates the atlas via the daemon push without a manual refresh
- [x] 5.5 Confirm the loopback guard: `/api/atlas` is rejected for a non-loopback Host/Origin, consistent with the other endpoints
