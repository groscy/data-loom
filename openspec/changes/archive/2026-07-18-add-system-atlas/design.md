# Design — System Atlas

## Context

DataLoom already reads the whole OpenSpec workspace, but the browser only ever receives capability *names* and phase/status (`RoadmapModel`). The archived proposals appear as a flat, name-only "done band." The goal of this change is a navigable **overview of the entire system** — living architecture documentation in which each requirement carries its **provenance** (which change introduced or modified it, and when) — without violating DataLoom's core principles: *derived, not stored*; *mechanical, no NLP*; *mirror, never launcher*; *loopback only*.

The *personalized* "what changed since **your** last visit" overlay is split into a dependent follow-on change, [`add-atlas-recency`](../add-atlas-recency/proposal.md). This change lays the foundation that overlay needs (the per-requirement provenance) and stands on its own as browsable documentation.

## The backbone decision: specs are the structure, proposals are the overlay

There are two distinct bodies of content in the workspace, and they play different roles:

```
 changes/archive/  (26 dated proposals)        specs/  (19 capabilities)
   proposal.md · design.md · spec deltas   ──▶   requirements + 234 scenarios
   = the CHANGELOG (deltas, time-ordered)  accum. = the CURRENT SYSTEM (state)
```

Arc42 documents a *current system*; proposals are *deltas* ("additionally renders…"). Pouring deltas into a Building Block View fights the template. So:

- **`specs/` is the structural backbone** — one settled capability = one building block. This is what "an overview of the entire system" is built from.
- **The archived proposals are the overlay** — they supply the *why* (their `design.md` / "Why") for the Decisions section, and the *when / by-whom* (their dated folders × the requirements they touch) for each requirement's provenance.

The specs are the *what-it-is*; the proposals are the *why* and the *when*. Both remain fully derived.

## Arc42-flavored, only the sections the data fills

A strict 12-section Arc42 would be lopsided: three sections overflow and nine are empty or need authored prose (which would break *derived, not stored*). We render **only the populated sections**, using Arc42 vocabulary without its rigid skeleton:

| Atlas section | Source | Notes |
| --- | --- | --- |
| Overview & Goals | `openspec/config.yaml` `context` | project-authored, per-project; also carries tech-stack + conventions |
| Building Blocks | `specs/*/` requirements | one block per capability; grouped by domain (below) |
| — behavior | `specs/*/` `#### Scenario:` blocks | shown inline within each block (234 scenarios total) |
| Decisions & rationale | archived `design.md` + proposal "Why" | 25 of 26 archived changes carry a `design.md` |

Everywhere: each requirement's provenance (see below). Sections whose source is absent are simply omitted — never shown as an empty official heading.

> Note: all 19 spec `## Purpose` fields are the "TBD — created by archiving" placeholder, so a building block's one-line summary cannot come from `Purpose`. Blocks are built from their **requirement titles** (`### Requirement: …`), which are human-readable, with scenarios beneath. This is why the atlas leans on requirements/scenarios rather than a capability abstract.

## Grouping: the project's own domain, mechanically

Grouping must **not** hardcode DataLoom's own subsystems, because the atlas serves any OpenSpec project. The project already declares its domain in `config.yaml` `context` (for DataLoom: "two aspects — WHAT/roadmap, HOW/MCP"). That prose **frames** the domains as the overview narrative. For binding each capability to a group, the only purely-mechanical signal that needs no authoring is **shared name affinity** (leading token):

```
 roadmap-* (4)   mcp-* (2)   claude-* (2)   + 11 singletons
```

Decision for v1: **prefix-affinity groups; singletons stand alone; the config overview frames the domains.** It is honest (half-grouped on DataLoom's own names) but requires zero authoring and zero guessing.

Alternatives considered:
- *Config-declared domain map* (e.g. `domains: {roadmap: [...]}` in `config.yaml`) — cleanest grouping, but adds a new convention + authoring burden. Deferred as a future opt-in enhancement.
- *Co-change coupling* (capabilities modified together by the same proposals form a domain) — mechanical and richer than prefixes, but a clustering algorithm is more than v1 needs. Deferred.
- *Flat list under the narrative* — simplest, but drifts back toward the "long list" this change exists to escape.

## Change provenance — the foundation the overlay builds on

Every archive folder is dated (`2026-07-11-show-proposal-tasks`) and each proposal records the capabilities and requirements it touches. This change derives, and *displays*, provenance at two grains:

```
 introduced(cap)   = date of the change that ADDED the capability
 last-changed(cap) = max date over changes that MODIFY it
 introduced(req)   = change whose delta lists the requirement title under ## ADDED
 modified(req)[]   = changes whose delta lists it under ## MODIFIED
```

(See *The building-block page* for the requirement-title join.) Here the provenance drives the **header dates** on each building-block page and the **"shaping decisions & history"** section, and lets each requirement link to the change that shaped it. It does **not** yet compare anything against a per-viewer cursor.

The *personalized* layer — mark what changed since **your** last visit, expand those requirements by default, clear as you read — is the follow-on [`add-atlas-recency`](../add-atlas-recency/proposal.md). It needs no new daemon data: it compares this change's already-served provenance dates against a client-side `lastSeenAt`. Splitting it out keeps this change a self-contained, shippable "browse the system" deliverable and keeps the overlay's UI-state concerns (localStorage, mark-all-read) out of the derivation.

## The building-block page

A building block is backed by a full behavioral spec, and density is extreme — `release-pipeline` has 1 requirement, `roadmap-view` has 16 (with 32 scenarios). One fixed layout cannot serve both, so the page is **an outline of requirement titles that expands on demand**. The requirement — not the capability — is the atomic unit of the page.

### Requirement-level provenance (the unlock)

The archived spec deltas name the *exact* requirement they touch: `show-proposal-tasks`'s delta for `roadmap-view` is `## MODIFIED Requirements → ### Requirement: Node detail inspection` — one of 16. So provenance is derivable per requirement, by **matching the requirement title across the archived deltas**:

```
 introduced(req)   = change whose delta lists the title under ## ADDED Requirements
 modified(req)[]   = changes whose delta lists it under ## MODIFIED Requirements
 (join key = requirement title; crossed with the archive folder date)
```

This holds on the real data: across the archive there are 46 ADDED / 8 MODIFIED / 5 REMOVED and **0 RENAMED** operations, and "Node detail inspection" resolves cleanly to its two touching changes (added `06-27` scaffold, modified `07-11` show-proposal-tasks). The title is a reliable join key here. The 46:8 ADDED:MODIFIED ratio means the marks stay **sparse and precise** — most pages have zero or one changed requirement, not a wall.

**What this buys the page:** each requirement can show who introduced/last-changed it and when, and link to that change's rationale — so even without the personalized overlay, a reader sees which parts are recent. It also sets up the follow-on: because provenance is *per-requirement*, the [`add-atlas-recency`](../add-atlas-recency/proposal.md) overlay can *drive the default disclosure* — expand the requirements changed since your last visit, collapse the rest — turning a 16-requirement page into a straight line to the one new requirement. Sparse and precise (46:8 ADDED:MODIFIED), from data already in the archive, by title-match, no NLP.

### The "why" is change-grained, the page is capability-grained

A `design.md` is written about the *change* ("embed the task list in each `ChangeNode` vs. a lazy endpoint"), and one change can span several capabilities — so a design.md cannot be cleanly sliced per requirement without fuzzy matching (which would be NLP, and is out). Resolution: a page-footer **"Shaping decisions & history"** — the changes that added/modified this capability's requirements, newest first, each expandable to its `Why` + `Decisions`. Per requirement, a lightweight `why →` affordance **deep-links** into that list at the shaping change. Rationale stays available, attribution stays honest (change-grained, as written), requirements stay clean. Slicing design.md per requirement was considered and rejected as unmechanical.

### Two properties that fall out

- **Each page is a mini-Arc42.** Requirements = what it is (§5), scenarios = how it behaves (§6), design.md = why (§9), archive dates = provenance. The atlas is Arc42-flavored *across* capabilities and *within* each one — the same shape, fractally.
- **The requirement outline is self-summarizing** — which quietly absorbs the TBD-`Purpose` problem. With no curated one-liner available, the collapsed list of requirement titles (*Phased layout · Status axis · Done band · Live reaction · Node detail · …*) already says what the capability does. The spine is the summary; no synthesized abstract is needed.

## Data channel + rendering

- **New content channel.** The model has never carried spec/proposal bodies. Add a read-only loopback `GET /api/atlas` (or extend the WebSocket push) delivering the assembled `AtlasModel`. The existing Host/Origin guard applies unchanged; the payload is only the user's own workspace files (no secrets). Prose can be sizeable (all specs + decisions) — assemble once per derive and let the browser lazy-render per section if needed.
- **Markdown.** The spec/proposal files use a constrained subset (`#`/`##`/`###`, `-` bullets, `**bold**`, `#### Scenario:` WHEN/THEN). A ~50-line purpose-built renderer covers it, preserving the frontend's zero-JS-dependency stance rather than pulling in a markdown library.

## Non-goals

- Strict/complete Arc42 (all 12 sections). Explicitly flavored, populated-sections-only.
- Any authored narrative sections maintained by hand. Everything derives from existing workspace files.
- Editing specs or proposals from the atlas. Strictly read-only.
- Removing or replacing the roadmap's done band. Additive; the done band stays as a quick roadmap affordance (a later change could link it to the atlas).
- A config-declared domain map or co-change clustering. Future enhancements, not v1.
- The personalized since-last-visit overlay. Deliberately split into the follow-on [`add-atlas-recency`](../add-atlas-recency/proposal.md); this change derives and displays provenance but does not compare it against a per-viewer cursor.

## Risks

- **Placeholder purposes** — with every `Purpose` set to TBD, block summaries rely on requirement titles; if a project writes terse requirement titles, blocks read thinly. Mitigation: fall back to the introducing proposal's "Why" for a one-liner.
- **Singleton tail** — on projects whose capability names don't share prefixes, most blocks are ungrouped and the overview leans entirely on the `config.yaml` narrative. Acceptable for v1; the config-declared map is the escape hatch.
- **Requirement-title join breaks on rename** — requirement provenance matches by title, so a future `RENAMED` (or a MODIFIED that also retitles) would split one requirement's history in two. None exist today (0 RENAMED across the archive); when they appear, an unmatched requirement degrades to empty provenance (no error), and OpenSpec's `RENAMED` delta carries the FROM/TO titles to repair the chain if it becomes worth doing.
