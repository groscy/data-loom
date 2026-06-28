// The heart of the roadmap: turn OpenSpec data into a phase x status model.
// Derivation is a pure function of the current workspace — nothing is stored.

import type { OpenSpecClient, ChangeListEntry } from "./openspecClient.js";
import type { ChangeNode, Conflict, Phase, RoadmapModel, Status } from "./types.js";

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

  // Explicit `## Depends On` declarations per change.
  const explicitDeps = new Map<string, string[]>();
  await Promise.all(
    names.map(async (n) => explicitDeps.set(n, await client.readProposalDependsOn(n))),
  );

  // Dependency-review state: whether a `## Depends On` section exists at all
  // (even empty). Pure metadata — never feeds the edges or phases below.
  const reviewed = new Map<string, boolean>();
  await Promise.all(
    names.map(async (n) => reviewed.set(n, await client.hasDependsOnSection(n))),
  );
  const nameSet = new Set(names);
  const archivedBare = new Set(archived.map((a) => a.replace(/^\d{4}-\d{2}-\d{2}-/, "")));

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
    // Explicit cross-proposal dependencies, merged with the capability edges.
    for (const dep of explicitDeps.get(c.name) ?? []) {
      if (dep === c.name) continue;
      if (nameSet.has(dep)) dependsOn.add(dep); // active change -> edge
      else if (archivedBare.has(dep)) continue; // archived/done -> satisfied
      else unsatisfied.push(dep); // unknown name -> conflict
    }
    depMap.set(c.name, [...dependsOn]);
    nodes.push({
      name: c.name,
      phase: 0,
      status: deriveStatus(c, false),
      readiness: "done",
      newCapabilities: newCaps,
      modifiedCapabilities: modifiedCaps,
      dependsOn: [...dependsOn],
      unsatisfiedDependencies: unsatisfied,
      dependencyReview: reviewed.get(c.name) ? "declared" : "pending",
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
      readiness: "done",
      newCapabilities: [],
      modifiedCapabilities: [],
      dependsOn: [],
      unsatisfiedDependencies: [],
      dependencyReview: "declared",
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

  // Readiness: ready when every active dependency is done; blocked otherwise.
  const statusByName = new Map(nodes.map((n) => [n.name, n.status] as const));
  for (const node of nodes) {
    if (node.archived || node.status === "done") {
      node.readiness = "done";
    } else {
      node.readiness = node.dependsOn.some((d) => statusByName.get(d) !== "done") ? "blocked" : "ready";
    }
  }

  // Surface conflicts (detection never aborts the rest of the derivation).
  const conflicts: Conflict[] = [];
  try {
    for (const cyc of findCycles(depMap)) {
      conflicts.push({
        type: "cycle",
        changes: cyc,
        description: `Dependency cycle: ${[...cyc, cyc[0]].join(" → ")}`,
      });
    }
    for (const node of nodes) {
      for (const cap of node.unsatisfiedDependencies) {
        conflicts.push({
          type: "dangling",
          changes: [node.name],
          capability: cap,
          description: `${node.name} modifies "${cap}", which no change adds and no baseline provides`,
        });
      }
    }
  } catch {
    /* leave conflicts empty rather than failing the roadmap */
  }

  return {
    generatedAt: new Date().toISOString(),
    changes: nodes,
    phases,
    baselineCapabilities: baseline,
    conflicts,
  };
}

/** Find dependency cycles via DFS back-edge detection over the dependency map. */
function findCycles(depMap: Map<string, string[]>): string[][] {
  const color = new Map<string, number>(); // 0 = unvisited, 1 = on stack, 2 = done
  const stack: string[] = [];
  const cycles: string[][] = [];
  const dfs = (n: string): void => {
    color.set(n, 1);
    stack.push(n);
    for (const dep of depMap.get(n) ?? []) {
      if (!depMap.has(dep)) continue;
      const c = color.get(dep) ?? 0;
      if (c === 1) {
        const idx = stack.indexOf(dep);
        if (idx >= 0) cycles.push(stack.slice(idx));
      } else if (c === 0) {
        dfs(dep);
      }
    }
    stack.pop();
    color.set(n, 2);
  };
  for (const n of depMap.keys()) {
    if ((color.get(n) ?? 0) === 0) dfs(n);
  }
  return cycles;
}

function deriveStatus(c: Pick<ChangeListEntry, "completedTasks" | "totalTasks">, archived: boolean): Status {
  if (archived) return "done";
  if (c.totalTasks > 0 && c.completedTasks >= c.totalTasks) return "done";
  if (c.completedTasks > 0) return "in-progress";
  return "draft";
}
