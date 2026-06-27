// Shared model types — the contract between the daemon and the browser view.

export type Status = "draft" | "in-progress" | "done";

/** One roadmap node = one OpenSpec change. */
export interface ChangeNode {
  name: string;
  /** Topological phase (1-based). 0 only for archived nodes, which live in the done band. */
  phase: number;
  status: Status;
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

/** The complete, derived roadmap pushed to the browser. */
export interface RoadmapModel {
  generatedAt: string;
  changes: ChangeNode[];
  phases: Phase[];
  baselineCapabilities: string[];
}
