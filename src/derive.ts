// The heart of the roadmap: turn OpenSpec data into a phase x status model.
// Derivation is a pure function of the current workspace — nothing is stored.

import type { OpenSpecClient, ChangeListEntry } from "./openspecClient.js";
import type { ChangeNode, Phase, RoadmapModel, Status } from "./types.js";

export async function deriveModel(client: OpenSpecClient): Promise<RoadmapModel> {
  const [list, archived, baseline] = await Promise.all([
    client.listChanges(),
    client.listArchived(),
    client.listBaselineCapabilities(),
  ]);
  const baselineSet = new Set(baseline);
  const names = list.map((c) => c.name);

  // Per-change capability ownership declarations (New / Modified).
  const caps = new Map<string, { newCaps: string[]; modifiedCaps: string[] }>();
  await Promise.all(
    names.map(async (n) => caps.set(n, await client.readProposalCaps(n))),
  );

  // owner[capability] = the change that introduces it (lists it under New).
  const owner = new Map<string, string>();
  for (const n of names) {
    for (const cap of caps.get(n)!.newCaps) {
      if (!owner.has(cap)) owner.set(cap, n);
    }
  }

  // Build nodes + dependency edges.
  const depMap = new Map<string, string[]>();
  const nodes: ChangeNode[] = [];
  for (const c of list) {
    const { newCaps, modifiedCaps } = caps.get(c.name)!;
    const dependsOn = new Set<string>();
    const unsatisfied: string[] = [];
    for (const cap of modifiedCaps) {
      if (baselineSet.has(cap)) continue; // satisfied by the settled baseline
      const o = owner.get(cap);
      if (o && o !== c.name) dependsOn.add(o);
      else if (!o) unsatisfied.push(cap); // dangling / out-of-order (surfaced in Phase 2)
    }
    depMap.set(c.name, [...dependsOn]);
    nodes.push({
      name: c.name,
      phase: 0,
      status: deriveStatus(c, false),
      newCapabilities: newCaps,
      modifiedCapabilities: modifiedCaps,
      dependsOn: [...dependsOn],
      unsatisfiedDependencies: unsatisfied,
      archived: false,
      completedTasks: c.completedTasks,
      totalTasks: c.totalTasks,
    });
  }

  // Archived changes -> done band (not part of the active DAG).
  for (const a of archived) {
    if (names.includes(a)) continue;
    nodes.push({
      name: a,
      phase: 0,
      status: "done",
      newCapabilities: [],
      modifiedCapabilities: [],
      dependsOn: [],
      unsatisfiedDependencies: [],
      archived: true,
      completedTasks: 0,
      totalTasks: 0,
    });
  }

  // Phase = longest-path depth in the DAG, with a cycle guard so a malformed
  // graph still yields a layout instead of crashing.
  const memo = new Map<string, number>();
  const inStack = new Set<string>();
  const depth = (n: string): number => {
    const cached = memo.get(n);
    if (cached !== undefined) return cached;
    if (inStack.has(n)) return 1; // back-edge: break the cycle defensively
    inStack.add(n);
    let d = 1;
    for (const dep of depMap.get(n) ?? []) {
      if (depMap.has(dep)) d = Math.max(d, depth(dep) + 1);
    }
    inStack.delete(n);
    memo.set(n, d);
    return d;
  };
  for (const node of nodes) {
    if (!node.archived) node.phase = depth(node.name);
  }

  // Group into ordered phases.
  const byPhase = new Map<number, string[]>();
  for (const node of nodes) {
    if (node.archived) continue;
    const list = byPhase.get(node.phase) ?? [];
    list.push(node.name);
    byPhase.set(node.phase, list);
  }
  const phases: Phase[] = [...byPhase.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([phase, changeNames]) => ({ phase, changeNames }));

  return {
    generatedAt: new Date().toISOString(),
    changes: nodes,
    phases,
    baselineCapabilities: baseline,
  };
}

function deriveStatus(c: Pick<ChangeListEntry, "completedTasks" | "totalTasks">, archived: boolean): Status {
  if (archived) return "done";
  if (c.totalTasks > 0 && c.completedTasks >= c.totalTasks) return "done";
  if (c.completedTasks > 0) return "in-progress";
  return "draft";
}
