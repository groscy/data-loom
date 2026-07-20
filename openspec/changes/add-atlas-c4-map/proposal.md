## Why

The atlas is the only DataLoom view with no picture. The roadmap and the MCP topology each render as a navigable board, but the settled system — 21 capabilities across 15 domain groups, each with its requirements and shaping history — is a single long scrolling document. There is no way to see the shape of the system at a glance, and no way to get from "which part handles this?" to the relevant requirement without scrolling past everything in between. As the archive grows the document only gets longer, so the view degrades exactly as the project it documents succeeds.

A C4-style map fixes both halves: it gives the atlas a picture that stays readable at any size, and it turns that picture into the navigation — zoom from the whole system down to a single capability, then land in the prose already scrolled to where you meant to go.

## What Changes

- Add a **C4-style map as the atlas tab's entry point**, rendered on the same pan/zoom canvas the roadmap and topology already use. Three levels, drilled by clicking a node:
  - **L1 — System Context**: the whole workspace as one system, framed by the `config.yaml` overview, with each domain group as a node.
  - **L2 — Containers**: one group opened — its building blocks as nodes, siblings shown as context at the edges.
  - **L3 — Components**: one building block opened — its requirements as nodes, with the block's provenance and shaping history summarized.
- Drilling past L3 (or clicking a requirement) **hands off to the existing atlas document**, scrolled to that capability and with that requirement expanded. The document view is unchanged; the map becomes the layer on top of it, and a breadcrumb carries the reader back up.
- **Derive relations between capabilities from co-change coupling**: two capabilities are related when archived changes touched both, weighted by how many. The atlas model gains a `relations` list; the map draws it as edges at L1 (between groups, aggregated) and L2 (between blocks). No NLP, no source parsing — the join comes from data the model already carries.
- The **recency overlay carries onto the map**: nodes whose subtree contains something introduced or modified since the last visit are marked, using the same new-vs-modified distinction as the document, so the map answers "what moved?" before you drill.
- The map is **read-only and derived**, like everything else in the atlas — it presents no control that edits a spec.

## Capabilities

### New Capabilities
- `atlas-map`: The C4-style navigable map of the settled system — its levels and what each shows, how drilling moves between them, how it hands off to the atlas document, how relations and recency are drawn, and its pan/zoom/fit navigation contract.

### Modified Capabilities
- `atlas-derivation`: The derived atlas model gains capability **relations** — mechanically derived co-change coupling from the archived changes, with a weight and the changes that produced each edge.
- `atlas-view`: The atlas tab now opens on the map rather than the document; the "Separate atlas subpage" requirement changes to describe the map-then-document structure, and the document gains the contract for being entered at a target capability/requirement from the map.

## Impact

- **Daemon** — [`src/atlas.ts`](src/atlas.ts) gains the relation derivation (a pure function over the already-read archived changes); [`src/types.ts`](src/types.ts) gains `AtlasRelation` and an `AtlasModel.relations` field. No new reads, no new files parsed, no new dependencies. `GET /api/atlas` and the WebSocket `atlas` push carry the larger payload unchanged in shape.
- **Browser** — [`public/app.js`](public/app.js) gains a `renderAtlasMap()` sibling to `renderBoard()`/`renderTopology()`, driven by a third `createCanvasController` instance; [`public/index.html`](public/index.html) gains the canvas-viewport markup inside `#atlas`; [`public/style.css`](public/style.css) gains the `.atlas-map-*` rules and must extend the `#roadmap.active, #topology.active` flex rule to cover the atlas tab's new layout.
- **Existing behavior** — the atlas document, its lazy bodies, its anchors, and the `dataloom-atlas-seen:<project>` recency cursor all stay as they are; the map reads the same state and reuses the same anchors.
- **Docs** — [`ARCHITECTURE.md`](ARCHITECTURE.md) still describes the SPA as "a roadmap tab and an MCP topology tab" and omits the atlas entirely; this change updates the module map and the consumer description.
- **Not affected** — the roadmap, the MCP topology, the MCP server, the daemon lifecycle, and every capability outside `atlas-*`.
