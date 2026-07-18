// Thin wrapper around the `openspec` CLI plus the small amount of structured
// proposal metadata the CLI does not expose (capability ownership).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TaskGroup, AtlasScenario } from "./types.js";

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

/** One requirement parsed from a settled `specs/<cap>/spec.md` (no provenance yet). */
export interface RequirementSpec {
  title: string;
  text: string;
  scenarios: AtlasScenario[];
}

/** A settled capability = one building block's raw content. */
export interface CapabilitySpec {
  name: string;
  requirements: RequirementSpec[];
}

/** The requirement titles an archived change's delta added / modified for one capability. */
export interface ArchiveDelta {
  capability: string;
  added: string[];
  modified: string[];
}

/** Everything an archived change contributes to the atlas: decisions + provenance material. */
export interface ArchivedChangeData {
  /** Bare change name (date prefix stripped). */
  name: string;
  /** Archive date `YYYY-MM-DD` (from the folder prefix); "" if unprefixed. */
  date: string;
  /** The proposal's `## Why` prose. */
  why: string;
  /** The change's `design.md` (empty when it had none). */
  design: string;
  newCaps: string[];
  modifiedCaps: string[];
  deltas: ArchiveDelta[];
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

  // ── System Atlas readers ──────────────────────────────────────────────────
  // Read (never write) the raw material for the derived architecture atlas.
  // Each is tolerant: a missing/unreadable source yields empty, never throws,
  // so an incomplete workspace still produces a partial atlas.

  /**
   * The project's `openspec/config.yaml` `context:` block scalar — the
   * project-authored overview narrative. Empty string when the file or the
   * block is absent. Parsed by hand (no YAML dependency): the block is the
   * indented lines under `context: |`, dedented, ending at the first dedent.
   */
  async readConfigContext(): Promise<string> {
    const path = join(this.openspecDir(), "config.yaml");
    return parseYamlBlockScalar(await readOrEmpty(path), "context");
  }

  /** Settled capabilities from `specs/<cap>/spec.md`: name + requirements (title, prose, scenarios). */
  async readCapabilitySpecs(): Promise<CapabilitySpec[]> {
    const specsDir = join(this.openspecDir(), "specs");
    const names = (await this.listDirNames(specsDir)).sort();
    const out: CapabilitySpec[] = [];
    for (const name of names) {
      const text = await readOrEmpty(join(specsDir, name, "spec.md"));
      if (!text) continue;
      out.push({ name, requirements: parseRequirements(text) });
    }
    return out;
  }

  /**
   * Archived changes with the material for the Decisions section and for
   * provenance: each change's `## Why`, its `design.md`, the capabilities it
   * added/modified, and the requirement titles its spec deltas added/modified.
   */
  async readArchivedChanges(): Promise<ArchivedChangeData[]> {
    const archiveDir = join(this.openspecDir(), "changes", "archive");
    const dirs = await this.listDirNames(archiveDir);
    const out: ArchivedChangeData[] = [];
    for (const dir of dirs) {
      const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(dir);
      const date = m ? m[1] : "";
      const name = m ? m[2] : dir;
      const base = join(archiveDir, dir);
      const propText = await readOrEmpty(join(base, "proposal.md"));
      out.push({
        name,
        date,
        why: sectionBody(propText, "Why"),
        design: await readOrEmpty(join(base, "design.md")),
        newCaps: capsInSection(propText, "New Capabilities"),
        modifiedCaps: capsInSection(propText, "Modified Capabilities"),
        deltas: await this.readArchiveDeltas(join(base, "specs")),
      });
    }
    return out;
  }

  /** The ADDED/MODIFIED requirement titles per capability in one archived change's `specs/`. */
  private async readArchiveDeltas(specsDir: string): Promise<ArchiveDelta[]> {
    const caps = await this.listDirNames(specsDir);
    const out: ArchiveDelta[] = [];
    for (const capability of caps) {
      const text = await readOrEmpty(join(specsDir, capability, "spec.md"));
      if (!text) continue;
      out.push({
        capability,
        added: requirementTitlesUnder(text, "ADDED"),
        modified: requirementTitlesUnder(text, "MODIFIED"),
      });
    }
    return out;
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

/** Read a file as UTF-8, returning "" if it is missing or unreadable. */
async function readOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

/**
 * Extract a YAML block scalar `key: |` (or `>`, with optional chomping) as
 * plain text, dedented by the block's own indentation. Ends at the first line
 * whose indentation drops below the block (e.g. a top-level `# comment` or the
 * next key). Returns "" if the key/block is absent. Deliberately tiny — it only
 * needs to read one authored prose block, not parse arbitrary YAML.
 */
function parseYamlBlockScalar(yaml: string, key: string): string {
  const lines = yaml.split(/\r?\n/);
  const head = new RegExp(`^${key}:\\s*[|>][+-]?\\s*$`);
  let i = lines.findIndex((l) => head.test(l));
  if (i < 0) return "";
  const body: string[] = [];
  let indent = -1;
  for (i += 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      body.push("");
      continue;
    }
    const lead = line.length - line.trimStart().length;
    if (indent < 0) indent = lead; // first body line sets the block indent
    if (lead < indent) break; // dedent → block ends
    body.push(line.slice(indent));
  }
  return body.join("\n").trim();
}

/** The prose body of a `## <heading>` section (until the next `##`/`#` heading), trimmed. */
function sectionBody(text: string, heading: string): string {
  const re = new RegExp(`(?:^|\\n)##\\s+${heading}\\s*\\n([\\s\\S]*?)(?:\\n#{1,2}\\s|$)`);
  const m = re.exec(text);
  return m ? m[1].trim() : "";
}

/** Requirement titles listed under a `## <op> Requirements` delta section. */
function requirementTitlesUnder(text: string, op: string): string[] {
  const re = new RegExp(`(?:^|\\n)##\\s+${op}\\s+Requirements\\b([\\s\\S]*?)(?:\\n##\\s|$)`);
  const m = re.exec(text);
  if (!m) return [];
  const titles: string[] = [];
  const heading = /^###\s+Requirement:\s*(.+?)\s*$/gm;
  let mm: RegExpExecArray | null;
  while ((mm = heading.exec(m[1])) !== null) titles.push(mm[1]);
  return titles;
}

/**
 * Parse a settled spec into its requirements: each `### Requirement: <title>`
 * with its normative prose and its `#### Scenario:` blocks. A `## ` heading
 * (Purpose, Requirements, …) ends the current requirement; scenario body runs
 * until the next scenario, requirement, or `## ` heading. Tolerant: a spec with
 * no requirements yields `[]`.
 */
function parseRequirements(text: string): RequirementSpec[] {
  const reqs: RequirementSpec[] = [];
  let cur: RequirementSpec | null = null;
  let scenario: AtlasScenario | null = null;
  const flush = (): void => {
    if (cur && scenario) {
      scenario.body = scenario.body.trim();
      cur.scenarios.push(scenario);
    }
    scenario = null;
  };
  for (const line of text.split(/\r?\n/)) {
    const req = /^###\s+Requirement:\s*(.+?)\s*$/.exec(line);
    if (req) {
      flush();
      cur = { title: req[1], text: "", scenarios: [] };
      reqs.push(cur);
      continue;
    }
    const scen = /^####\s+Scenario:\s*(.+?)\s*$/.exec(line);
    if (scen) {
      flush();
      if (cur) scenario = { title: scen[1], body: "" };
      continue;
    }
    if (/^##\s/.test(line)) {
      flush();
      cur = null;
      continue;
    }
    if (!cur) continue;
    if (scenario) scenario.body += line + "\n";
    else cur.text += line + "\n";
  }
  flush();
  for (const r of reqs) r.text = r.text.trim();
  return reqs;
}
