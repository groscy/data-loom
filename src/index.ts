#!/usr/bin/env node
// data_loom daemon entry point: verify the openspec CLI, derive the roadmap,
// discover the MCP setup, serve the SPA, and keep it live — for a selectable
// project that can be switched at runtime.

import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { OpenSpecClient } from "./openspecClient.js";
import { deriveModel } from "./derive.js";
import { watchOpenspec } from "./watcher.js";
import { startServer, type RunningServer } from "./server.js";
import { discover } from "./mcp/discovery.js";
import { checkServer } from "./mcp/availability.js";
import { discoverProjects, isViewableProject, type ProjectModel } from "./projects.js";
import { resolvePublicDir } from "./assets.js";
import type { RoadmapModel } from "./types.js";
import type { McpModel, McpServer, ProbeTarget } from "./mcp/types.js";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4317);

// Initial project: CLI argument, then DATA_LOOM_ROOT, then cwd.
const initialProject = resolve(process.argv[2] ?? process.env.DATA_LOOM_ROOT ?? process.cwd());

interface Session {
  project: string;
  client: OpenSpecClient;
  model: RoadmapModel;
  mcpServers: McpServer[];
  probes: Map<string, ProbeTarget>;
  stopWatch: () => void;
}

let session: Session | undefined;
let server: RunningServer | undefined;

async function main(): Promise<void> {
  // openspec is an external prerequisite — fail loudly with install guidance.
  try {
    const version = await new OpenSpecClient(initialProject).checkAvailable();
    console.log(`[data-loom] openspec CLI ${version}`);
  } catch {
    console.error(
      "[data-loom] ERROR: the `openspec` CLI was not found.\n" +
        "data_loom does not bundle it — install it separately, e.g. `npm i -g openspec`, then retry.",
    );
    process.exit(1);
  }

  // Resolve a viewable project: the launch dir, else the first discovered one,
  // else none. Never exit just because the launch dir isn't a project.
  let active: string | null = isViewableProject(initialProject) ? initialProject : null;
  if (!active) {
    const candidates = (await discoverProjects(initialProject)).candidates;
    active = candidates[0]?.path ?? null;
  }
  if (active) {
    session = await buildSession(active);
  } else {
    console.log("[data-loom] no openspec project found at launch — open the dashboard and pick one");
  }

  server = await startServer({
    publicDir: resolvePublicDir(),
    host,
    port,
    getRoadmap: () => session?.model ?? null,
    getMcp,
    checkMcp,
    getProjects,
    selectProject,
  });

  console.log(`[data-loom] dashboard ready at http://${host}:${server.port}`);
  if (session) console.log(`[data-loom] project: ${session.project}`);
  openBrowser(`http://${host}:${server.port}`);

  const shutdown = (): void => {
    session?.stopWatch();
    server?.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function buildSession(project: string): Promise<Session> {
  const client = new OpenSpecClient(project);
  const model = await deriveModel(client);
  let mcpServers: McpServer[] = [];
  let probes = new Map<string, ProbeTarget>();
  try {
    const disc = await discover(project);
    mcpServers = disc.servers;
    probes = disc.probes;
  } catch (err) {
    console.error("[data-loom] MCP discovery failed:", err);
  }
  const stopWatch = watchOpenspec(project, () => recompute());
  console.log(`[data-loom] loaded ${model.changes.filter((c) => !c.archived).length} change(s), ${mcpServers.length} MCP server(s)`);
  return { project, client, model, mcpServers, probes, stopWatch };
}

async function recompute(): Promise<void> {
  if (!session) return;
  try {
    session.model = await deriveModel(session.client);
    server?.broadcast({ type: "model", model: session.model });
    console.log(`[data-loom] roadmap recomputed — ${session.model.phases.length} phase(s)`);
  } catch (err) {
    console.error("[data-loom] derivation failed:", err);
  }
}

async function selectProject(path: string): Promise<ProjectModel> {
  const target = resolve(path);
  if (!isViewableProject(target)) {
    throw new Error(`No openspec/ workspace at ${target}`);
  }
  session?.stopWatch();
  session = await buildSession(target);
  const projects = await getProjects();
  server?.broadcast({ type: "project", project: projects });
  server?.broadcast({ type: "model", model: session.model });
  server?.broadcast({ type: "mcp", mcp: getMcp() });
  console.log(`[data-loom] switched project -> ${target}`);
  return projects;
}

function getMcp(): McpModel {
  return { hub: "Claude Code", servers: session?.mcpServers ?? [] };
}

async function checkMcp(name: string): Promise<McpServer | null> {
  const target = session?.probes.get(name);
  const sv = session?.mcpServers.find((s) => s.name === name);
  if (!target || !sv) return null;
  sv.liveness = await checkServer(target);
  sv.lastChecked = new Date().toISOString();
  return sv;
}

function getProjects(): Promise<ProjectModel> {
  return discoverProjects(session?.project ?? "");
}

function openBrowser(url: string): void {
  if (process.env.DATA_LOOM_NO_OPEN) return;
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    /* non-fatal — the URL is already logged */
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
