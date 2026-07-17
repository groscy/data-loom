// Thin wrapper around the `openspec` CLI plus the small amount of structured
// proposal metadata the CLI does not expose (capability ownership).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TaskGroup } from "./types.js";

const execFileP = promisify(execFile);

export interface ChangeListEntry {
  name: string;
  completedTasks: number;
  totalTasks: number;
  status: string;
  lastModified: string;
}

export interface Delta {
  spec: string; // capability name
  operation: string; // ADDED | MODIFIED | REMOVED | RENAMED
}

export interface ProposalCaps {
  newCaps: string[];
  modifiedCaps: string[];
}

export class OpenSpecClient {
  constructor(private readonly repoRoot: string) {}

  private openspecDir(): string {
    return join(this.repoRoot, "openspec");
  }

  /**
   * On Windows the CLI is a `.cmd` shim, so it must be invoked through a shell.
   * `windowsHide` keeps that shell's console window from flashing to the
   * foreground and stealing focus each time — the daemon runs headless
   * (detached / autostart, with no console of its own), so without this Windows
   * allocates a fresh, visible console for every invocation.
   */
  private async run(args: string[]): Promise<string> {
    const { stdout } = await execFileP("openspec", args, {
      cwd: this.repoRoot,
      shell: process.platform === "win32",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  }

  private async runJson<T = unknown>(args: string[]): Promise<T> {
    return parseLooseJson<T>(await this.run(args));
  }

  /** Resolves to the CLI version string, or throws if the CLI is missing. */
  async checkAvailable(): Promise<string> {
    return (await this.run(["--version"])).trim();
  }

  async listChanges(): Promise<ChangeListEntry[]> {
    const data = await this.runJson<{ changes?: ChangeListEntry[] }>(["list", "--json"]);
    return data.changes ?? [];
  }

  /** Distinct (capability, operation) pairs for a change, from the CLI. */
  async showDeltas(name: string): Promise<Delta[]> {
    const data = await this.runJson<{ deltas?: Array<{ spec: string; operation: string }> }>([
      "show",
      name,
      "--json",
    ]);
    const seen = new Set<string>();
    const out: Delta[] = [];
    for (const d of data.deltas ?? []) {
      const key = `${d.spec}|${d.operation}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ spec: d.spec, operation: d.operation });
      }
    }
    return out;
  }

  /** Capability ownership — read from the proposal, since the CLI does not expose it. */
  async readProposalCaps(name: string): Promise<ProposalCaps> {
    const path = join(this.openspecDir(), "changes", name, "proposal.md");
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      return { newCaps: [], modifiedCaps: [] };
    }
    return {
      newCaps: capsInSection(text, "New Capabilities"),
      modifiedCaps: capsInSection(text, "Modified Capabilities"),
    };
  }

  /** Explicit cross-proposal dependencies declared under a `## Depends On` section. */
  async readProposalDependsOn(name: string): Promise<string[]> {
    const path = join(this.openspecDir(), "changes", name, "proposal.md");
    try {
      return dependsOnInSection(await readFile(path, "utf8"));
    } catch {
      return [];
    }
  }

  /**
   * The change's task list, parsed directly from `tasks.md` (the CLI exposes
   * only counts, not task text). Sections come from `## …` headings; items from
   * `- [ ]` / `- [x]` bullets. Tolerant by design: a missing/unreadable file
   * yields `[]`, bullets before any heading fall under a single untitled group,
   * and non-bullet lines are ignored so a minimal or malformed file never throws.
   */
  async readTasks(name: string): Promise<TaskGroup[]> {
    const path = join(this.openspecDir(), "changes", name, "tasks.md");
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      return [];
    }
    return parseTasks(text);
  }

  /**
   * Whether the proposal declares a `## Depends On` section at all — even an
   * empty one. Distinct from {@link readProposalDependsOn}, which reports the
   * entries: a present-but-empty section means "reviewed, depends on nothing".
   */
  async hasDependsOnSection(name: string): Promise<boolean> {
    const path = join(this.openspecDir(), "changes", name, "proposal.md");
    try {
      return DEPENDS_ON_HEADING.test(await readFile(path, "utf8"));
    } catch {
      return false;
    }
  }

  /** Archived change names (completed nodes shown in the done band). */
  async listArchived(): Promise<string[]> {
    return this.listDirNames(join(this.openspecDir(), "changes", "archive"));
  }

  /** Settled capabilities already in the spec baseline. */
  async listBaselineCapabilities(): Promise<string[]> {
    return this.listDirNames(join(this.openspecDir(), "specs"));
  }

  private async listDirNames(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
}

/** Parse JSON that may be preceded by CLI warning lines on stdout. */
function parseLooseJson<T>(s: string): T {
  const start = s.search(/[[{]/);
  if (start < 0) {
    throw new Error(`No JSON found in openspec CLI output: ${s.slice(0, 160)}`);
  }
  return JSON.parse(s.slice(start)) as T;
}

/** The `## Depends On` section heading — used for both detection and parsing. */
const DEPENDS_ON_HEADING = /(?:^|\n)##\s+Depends On\b/;

/** Extract `- <change-name>` bullets under a `## Depends On` heading. */
function dependsOnInSection(text: string): string[] {
  const m = /(?:^|\n)##\s+Depends On\s*([\s\S]*?)(?:\n##\s|\n#\s|$)/.exec(text);
  if (!m) return [];
  const out: string[] = [];
  const bullet = /^-\s+`?([a-z0-9-]+)`?/gm;
  let mm: RegExpExecArray | null;
  while ((mm = bullet.exec(m[1])) !== null) out.push(mm[1]);
  return out;
}

/** A `## …` task section heading. */
const TASK_HEADING = /^##\s+(.+?)\s*$/;
/** A task bullet: `- [ ]` / `- [x]`, capturing the checkbox char and the remainder. */
const TASK_BULLET = /^\s*-\s*\[([ xX])\]\s*(.*)$/;

/**
 * Parse `tasks.md` into ordered sections of `{ text, done }` items. Bullets
 * before the first heading fall under a single untitled leading group; headings
 * with no items and every non-bullet line are dropped so nothing extraneous shows.
 */
function parseTasks(text: string): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let current: TaskGroup | null = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = TASK_HEADING.exec(line);
    if (heading) {
      current = { section: heading[1], items: [] };
      groups.push(current);
      continue;
    }
    const bullet = TASK_BULLET.exec(line);
    if (!bullet) continue; // ignore prose, blank lines, sub-headings
    if (!current) {
      current = { section: "", items: [] }; // bullets before any heading
      groups.push(current);
    }
    current.items.push({ text: bullet[2].trim(), done: bullet[1].toLowerCase() === "x" });
  }
  return groups.filter((g) => g.items.length > 0);
}

/** Extract `- \`cap-name\`: ...` bullets under a `### <heading>` block. */
function capsInSection(text: string, heading: string): string[] {
  const re = new RegExp(`###\\s+${heading}([\\s\\S]*?)(?:\\n###\\s|\\n##\\s|$)`);
  const m = re.exec(text);
  if (!m) return [];
  const caps: string[] = [];
  const bullet = /^-\s+`([a-z0-9-]+)`/gm;
  let mm: RegExpExecArray | null;
  while ((mm = bullet.exec(m[1])) !== null) caps.push(mm[1]);
  return caps;
}
