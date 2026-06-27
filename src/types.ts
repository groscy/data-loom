// Shared model types — the contract between the daemon and the browser view.

export type Status = "draft" | "in-progress" | "done";

/** Whether an open proposal can be implemented now. Finer than phase. */
export type Readiness = "ready" | "blocked" | "done";

/** One roadmap node = one OpenSpec change. */
export interface ChangeNode {
  name: string;
  /** Topological phase (1-based). 0 only for archived nodes, which live in the done band. */
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
  archived: boolean;
  completedTasks: number;
  totalTasks: number;
}

export interface Phase {
  phase: number;
  changeNames: string[];
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
