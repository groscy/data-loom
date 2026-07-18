// Assemble the System Atlas: the settled system as Arc42-flavored documentation.
// A pure function of the workspace (specs + config + archive), recomputed on
// change and never stored — the same contract as the roadmap derivation.
//
// Backbone: `specs/` capabilities are the building blocks; the archived changes
// are the overlay — their `design.md`/`Why` are the Decisions, and their dated
// deltas give each capability and requirement its provenance (who introduced or
// modified it, and when), matched by requirement title.

import type { OpenSpecClient } from "./openspecClient.js";
import type {
  AtlasBuildingBlock,
  AtlasDecision,
  AtlasGroup,
  AtlasModel,
  AtlasProvenance,
  AtlasProvenanceRef,
  AtlasRequirement,
} from "./types.js";

export async function deriveAtlas(client: OpenSpecClient): Promise<AtlasModel> {
  const [overview, specs, archived] = await Promise.all([
    client.readConfigContext(),
    client.readCapabilitySpecs(),
    client.readArchivedChanges(),
  ]);

  // Chronological order makes "introduced = first touch, modified = later ones".
  const byDate = [...archived].sort((a, b) => a.date.localeCompare(b.date));

  // Capability-level provenance: first ADD introduces it, later MODIFYs accrue.
  const capProv = new Map<string, AtlasProvenance>();
  const capProvOf = provOf(capProv);
  for (const ch of byDate) {
    const ref: AtlasProvenanceRef = { change: ch.name, date: ch.date };
    for (const cap of ch.newCaps) introduce(capProvOf(cap), ref);
    for (const cap of ch.modifiedCaps) capProvOf(cap).modified.push(ref);
  }

  // Requirement-level provenance, keyed by capability + requirement title. The
  // title is the join between the settled spec and the archived deltas.
  const reqProv = new Map<string, AtlasProvenance>();
  const reqProvOf = provOf(reqProv);
  for (const ch of byDate) {
    const ref: AtlasProvenanceRef = { change: ch.name, date: ch.date };
    for (const d of ch.deltas) {
      for (const title of d.added) introduce(reqProvOf(reqKey(d.capability, title)), ref);
      for (const title of d.modified) reqProvOf(reqKey(d.capability, title)).modified.push(ref);
    }
  }

  // Building blocks from the settled specs; each requirement carries its provenance.
  const blocks: AtlasBuildingBlock[] = specs.map((cap) => ({
    name: cap.name,
    provenance: capProv.get(cap.name) ?? emptyProv(),
    requirements: cap.requirements.map(
      (r): AtlasRequirement => ({
        title: r.title,
        text: r.text,
        scenarios: r.scenarios,
        provenance: reqProv.get(reqKey(cap.name, r.title)) ?? emptyProv(),
      }),
    ),
  }));

  // Decisions: every shaping change, newest first — the global section, and the
  // per-block "shaping history" (the browser joins by change name / capability).
  const decisions: AtlasDecision[] = [...archived]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((ch) => ({
      change: ch.name,
      date: ch.date,
      why: ch.why,
      design: ch.design,
      capabilities: [...new Set([...ch.newCaps, ...ch.modifiedCaps])],
    }));

  return {
    generatedAt: new Date().toISOString(),
    overview,
    groups: groupByDomain(blocks),
    decisions,
  };
}

const reqKey = (capability: string, title: string): string => `${capability}\n${title}`;

const emptyProv = (): AtlasProvenance => ({ introduced: null, modified: [] });

/** A get-or-create accessor over a provenance map. */
function provOf(map: Map<string, AtlasProvenance>): (key: string) => AtlasProvenance {
  return (key) => {
    let p = map.get(key);
    if (!p) {
      p = emptyProv();
      map.set(key, p);
    }
    return p;
  };
}

/** Record `ref` as the introduction, or as a later modification if already introduced. */
function introduce(prov: AtlasProvenance, ref: AtlasProvenanceRef): void {
  if (!prov.introduced) prov.introduced = ref;
  else prov.modified.push(ref);
}

/**
 * Group building blocks by the project's own domain: capabilities that share a
 * leading name token (`roadmap-*`, `mcp-*`) cluster; a capability whose prefix
 * is unique stands alone as its own singleton group. No hardcoded, project-
 * specific category names — the grouping is purely a function of the names.
 */
function groupByDomain(blocks: AtlasBuildingBlock[]): AtlasGroup[] {
  const prefixOf = (name: string): string => name.split("-")[0];
  const count = new Map<string, number>();
  for (const b of blocks) count.set(prefixOf(b.name), (count.get(prefixOf(b.name)) ?? 0) + 1);

  const groups: AtlasGroup[] = [];
  const byKey = new Map<string, AtlasGroup>();
  for (const b of blocks) {
    const prefix = prefixOf(b.name);
    const multi = (count.get(prefix) ?? 0) >= 2;
    const key = multi ? prefix : b.name;
    let g = byKey.get(key);
    if (!g) {
      g = { key, singleton: !multi, blocks: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.blocks.push(b);
  }
  return groups;
}
