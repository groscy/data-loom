// Shared model types — the contract between the daemon and the browser view.

export type Status = "draft" | "in-progress" | "done";

/** Whether an open proposal can be implemented now. Finer than phase. */
export type Readiness = "ready" | "blocked" | "done";

/**
 * Whether a change has been reviewed for dependencies. `declared` once its
 * proposal has a `## Depends On` heading (even an empty one); otherwise
 * `pending`. Metadata only — never affects phase, edges, or readiness.
 */
export type DependencyReview = "pending" | "declared";

/** One task item from a change's `tasks.md` bullet (`- [ ]` / `- [x]`). */
export interface TaskItem {
  text: string;
  done: boolean;
}

/** A `## …` section of `tasks.md` with the items beneath it. */
export interface TaskGroup {
  section: string;
  items: TaskItem[];
}

/** One roadmap node = one OpenSpec change. */
export interface ChangeNode {
  name: string;
  /** Topological phase (1-based). 0 only for archived nodes, which the roadmap does not place. */
  phase: number;
  status: Status;
  /** Implementation readiness — ready to start now, blocked by active work, or done. */
  readiness: Readiness;
  newCapabilities: string[];
  modifiedCapabilities: string[];
  /** Names of changes this change depends on (derived from capability ownership). */
  dependsOn: string[];
  /** Modified capabilities with no introducing change and no spec baseline (surfaced fully in Phase 2's conflict change). */
  unsatisfiedDependencies: string[];
  /** Dependency-review state, derived from the presence of a `## Depends On` heading. Metadata only. */
  dependencyReview: DependencyReview;
  archived: boolean;
  completedTasks: number;
  totalTasks: number;
  /** Structured, section-grouped task list from `tasks.md`. `[]` for archived changes and changes with no `tasks.md`. */
  tasks: TaskGroup[];
}

export interface Phase {
  phase: number;
  changeNames: string[];
}

// ── System Atlas ────────────────────────────────────────────────────────────
// A second, derived view of the same workspace: the settled system as
// Arc42-flavored living documentation. Assembled from `specs/` (structure),
// `config.yaml` (overview), and `changes/archive/` (decisions + provenance).
// Purely derived and read-only, like the roadmap — nothing is stored.

/** A change that touched something, with its archive date (`YYYY-MM-DD`). */
export interface AtlasProvenanceRef {
  change: string;
  date: string;
}

/** Where a capability or requirement came from: one introduction + later edits. */
export interface AtlasProvenance {
  /** The change that introduced it (ADDED). `null` if no archived change matches. */
  introduced: AtlasProvenanceRef | null;
  /** Later changes that modified it (MODIFIED), in chronological order. */
  modified: AtlasProvenanceRef[];
}

/** One behavior scenario within a requirement (the `#### Scenario:` block). */
export interface AtlasScenario {
  title: string;
  /** The scenario body (WHEN/THEN markdown), rendered client-side. */
  body: string;
}

/** One requirement within a capability, with its behavior and provenance. */
export interface AtlasRequirement {
  title: string;
  /** Normative prose (the SHALL text) between the heading and its scenarios. */
  text: string;
  scenarios: AtlasScenario[];
  provenance: AtlasProvenance;
}

/** One building block = one settled capability under `specs/`. */
export interface AtlasBuildingBlock {
  name: string;
  requirements: AtlasRequirement[];
  provenance: AtlasProvenance;
}

/** A domain group of building blocks (shared name prefix; singletons stand alone). */
export interface AtlasGroup {
  /** Shared prefix for a multi-member group, or the capability's own name for a singleton. */
  key: string;
  /** True when the group is a lone capability (no shared prefix) — render without a group heading. */
  singleton: boolean;
  blocks: AtlasBuildingBlock[];
}

/** A shaping decision: one archived change's rationale (proposal Why + design.md). */
export interface AtlasDecision {
  change: string;
  date: string;
  /** The proposal's `## Why` prose (may be empty). */
  why: string;
  /** The change's `design.md` content (may be empty when the change had none). */
  design: string;
  /** Capabilities this change added or modified — for attributing it to a block. */
  capabilities: string[];
}

/**
 * A relation between two settled capabilities, derived from co-change coupling:
 * archived changes that touched both. This is emphatically NOT a dependency —
 * it records that two capabilities moved together, with no direction and no
 * claim that one needs the other. The roadmap's edges mean "after"; these do not.
 */
export interface AtlasRelation {
  /** The pair, always sorted so `(a,b)` and `(b,a)` collapse to one relation. */
  a: string;
  b: string;
  /** How many archived changes touched both. */
  weight: number;
  /** Those changes, oldest first — what the view shows to justify the edge. */
  changes: string[];
}

/** The complete, derived architecture atlas pushed to the browser. */
export interface AtlasModel {
  generatedAt: string;
  /** Overview narrative from the project's `openspec/config.yaml` context (may be empty). */
  overview: string;
  /** Building blocks grouped by the project's own domain. */
  groups: AtlasGroup[];
  /** All shaping changes, newest first — the global Decisions section and per-block join source. */
  decisions: AtlasDecision[];
  /** Co-change coupling between capabilities — the map's edges. Empty with no archive. */
  relations: AtlasRelation[];
}

/** A surfaced ordering problem: a dependency cycle or a dangling/out-of-order dep. */
export interface Conflict {
  type: "cycle" | "dangling";
  changes: string[];
  capability?: string;
  description: string;
}

/** The complete, derived roadmap pushed to the browser. */
export interface RoadmapModel {
  generatedAt: string;
  changes: ChangeNode[];
  phases: Phase[];
  baselineCapabilities: string[];
  conflicts: Conflict[];
}
