// Thin wrapper around the `openspec` CLI plus the small amount of structured
// proposal metadata the CLI does not expose (capability ownership).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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

  /** On Windows the CLI is a `.cmd` shim, so it must be invoked through a shell. */
  private async run(args: string[]): Promise<string> {
    const { stdout } = await execFileP("openspec", args, {
      cwd: this.repoRoot,
      shell: process.platform === "win32",
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
