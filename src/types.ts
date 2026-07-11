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
