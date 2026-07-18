## Why

Archived work surfaces only as a collapsed "done band" — a flat row of change-name chips at the bottom of the roadmap. That is a changelog *by name*, not an understanding of the system those changes produced. Someone opening DataLoom (a newcomer, or the author returning after time away) cannot get an overview of what the whole system does now, and cannot see which parts recently changed.

The material for a real overview already exists in the workspace but never reaches the browser. The *current, settled truth* lives in `openspec/specs/` (19 accumulated capabilities, with 234 behavior scenarios), the *why* lives in the archived `design.md` and proposal files (25 of 26 archived changes carry a `design.md`), and the *project's own domain* is authored in `openspec/config.yaml`'s `context`. Today only capability **names** and phase/status travel over the model — none of the prose does. So the raw ingredients for living architecture documentation are present and derivable; they are simply not assembled or shown.

## What Changes

- A new **System Atlas** subpage (a third view beside Roadmap and MCP Topology) presents the settled system as Arc42-*flavored* living documentation — only the sections the workspace actually fills: an **Overview** (from the project's `config.yaml` context), the **Building Blocks** (each settled `specs/` capability, with its requirements and behavior scenarios), and the **Decisions & rationale** (from archived `design.md` and each proposal's "Why").
- The atlas is **derived, never stored** — assembled from `config.yaml` + `specs/` + `changes/archive/` and recomputed on file change, exactly like the roadmap. It is strictly **read-only** (mirror, never launcher).
- Building blocks are **grouped by the project's own domain**, not a DataLoom-specific taxonomy: the `config.yaml` context frames the domains and capabilities cluster by shared name affinity, with capabilities that share no group standing alone. No hardcoded category names.
- Each **building-block page** is an outline of its requirement titles that expands on demand — so a 1-requirement capability and a 16-requirement one both read well. Each requirement carries its **provenance** — which archived change introduced it and which later changes modified it, and when — derived by matching the requirement's title across the archived spec deltas (a title under a change's `## ADDED Requirements` = introduced; under `## MODIFIED Requirements` = modified), crossed with the dated archive folders. A per-capability **"shaping decisions & history"** section lists those changes (newest first, each with its `Why` + design decisions), and every requirement links to the change that shaped it.
- A new loopback content channel carries the atlas prose to the browser — the model has never carried spec/proposal *bodies* before. Loopback-only, subject to the existing Host/Origin guard, exposing only the user's own workspace files (no secrets).
- The existing done band is left unchanged; the atlas is purely additive.
- **Out of scope here — a dependent follow-on.** Marking what changed *since your last visit* (the personalized overlay that highlights the new parts as you return, expands them by default, and clears as you read) is a separate change, [`add-atlas-recency`](../add-atlas-recency/proposal.md), layered on this one. This change derives and displays each requirement's provenance; the follow-on adds the "since you last looked" marking on top of it.

## Capabilities

### New Capabilities

- `atlas-derivation`: the daemon assembles a derived architecture-atlas model — an overview from `config.yaml` context, one building block per settled `specs/` capability (requirement text + behavior scenarios), a decisions section from archived `design.md`/proposal rationale, and change provenance at both **capability and requirement** granularity (introduced / last-changed dates + the changes that touched each, from the dated archive folders crossed with the archived spec deltas' ADDED/MODIFIED requirement titles) — recomputed on change and served read-only over loopback.
- `atlas-view`: the browser renders the atlas as a separate Arc42-flavored subpage showing only the populated sections, with building blocks grouped by the project's own domain (config-framed + name-prefix affinity, singletons standing alone). Each building-block page is a density-adaptive requirement outline (expand on demand; a 1-requirement and a 16-requirement capability both read well) in which each requirement shows its provenance and links to the change that shaped it, backed by a per-capability "shaping decisions & history" section.

### Modified Capabilities

<!-- none -->

## Impact

- `src/types.ts` — new `AtlasModel` contract: overview, domain-grouped building blocks (each with requirement + scenario text and a change history), and decisions. Additive; the existing `RoadmapModel` is untouched.
- `src/openspecClient.ts` — readers for `config.yaml` context, settled `specs/*/spec.md` prose (requirements + scenarios), and archived `design.md` / proposal "Why"; provenance derived from archive folder dates crossed with each proposal's new/modified capabilities (capability level) and the archived `specs/*/spec.md` deltas' ADDED/MODIFIED requirement titles (requirement level).
- `src/derive.ts` (or a new `src/atlas.ts`) — assemble the `AtlasModel`; a pure function of the workspace, recomputed on change.
- `src/watcher.ts` — ensure `specs/`, `changes/archive/`, and `config.yaml` edits trigger recompute (the watcher already scopes `openspec/`).
- `src/server.ts` — a read-only loopback `GET /api/atlas` (or ride the WebSocket push); the loopback Host/Origin guard already applies.
- `public/index.html` — a third tab and a new atlas view section.
- `public/app.js` — atlas rendering (sections, domain grouping), the building-block page (density-adaptive requirement outline, behavior scenarios, per-requirement provenance, shaping-history section), and a small constrained-markdown renderer for the spec/decision prose.
- `public/style.css` — atlas layout, building-block outline and section styling, shaping-history treatment.
- No new runtime dependency: the spec/proposal markdown is a constrained subset (headings, bullets, bold, Scenario blocks) renderable by a small purpose-built renderer, keeping the frontend's zero-JS-dependency stance.

## Depends On
