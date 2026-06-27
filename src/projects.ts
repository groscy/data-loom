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

  // Always include the active project, even if it isn't in the config.
  const activeKey = normalizePath(active);
  if (!byNorm.has(activeKey)) {
    byNorm.set(activeKey, { path: active, name: basename(active) || active });
  }

  // Report `current` as the matching candidate's exact path string, so the
  // client's selected-option comparison works regardless of slash/case.
  const current = byNorm.get(activeKey)?.path ?? active;
  return { current, candidates: [...byNorm.values()] };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
