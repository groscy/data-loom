// Discover selectable projects from Claude Code's known projects, limited to
// those that actually contain an openspec/ workspace.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

export interface ProjectEntry {
  path: string;
  name: string;
}

export interface ProjectModel {
  current: string;
  candidates: ProjectEntry[];
}

/** True when the directory contains an openspec/ workspace. */
export function isViewableProject(path: string): boolean {
  return existsSync(join(path, "openspec"));
}

export async function discoverProjects(active: string): Promise<ProjectModel> {
  const byNorm = new Map<string, ProjectEntry>();

  const add = (path: string): void => {
    const key = normalizePath(path);
    if (byNorm.has(key)) return;
    if (!isViewableProject(path)) return;
    byNorm.set(key, { path, name: basename(path) || path });
  };

  // Claude Code known projects
  try {
    const cj = JSON.parse(await readFile(join(homedir(), ".claude.json"), "utf8"));
    for (const p of Object.keys(cj.projects ?? {})) add(p);
  } catch {
    /* no config -> only the active project */
  }

  // Include the active project (if any) only when it is itself viewable, so the
  // picker never offers a non-openspec directory. `current` is "" when no
  // project is active. Reported as the candidate's exact path string so the
  // client's selected-option comparison works regardless of slash/case.
  let current = "";
  if (active && isViewableProject(active)) {
    const key = normalizePath(active);
    if (!byNorm.has(key)) {
      byNorm.set(key, { path: active, name: basename(active) || active });
    }
    current = byNorm.get(key)!.path;
  }
  return { current, candidates: [...byNorm.values()] };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
