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
import { HOST, PORT } from "./paths.js";
import * as lifecycle from "./lifecycle.js";
import * as autostart from "./autostart.js";
import * as claudeDesktop from "./claudeDesktop.js";
import * as claudeCode from "./claudeCode.js";
import { initTray, type Tray } from "./tray.js";
import type { RoadmapModel } from "./types.js";
import type { McpModel, McpServer, ProbeTarget } from "./mcp/types.js";

const host = HOST;
const port = PORT;

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

  try {
    server = await startServer({
      publicDir: resolvePublicDir(),
      host,
      port,
      getRoadmap: () => session?.model ?? null,
      getMcp,
      checkMcp,
      getProjects,
      selectProject,
      getCurrentProject: () => session?.project ?? null,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      // A DataLoom daemon is already on this port (e.g. the background one).
      // That's fine — point at the running instance instead of crashing.
      console.log(`[data-loom] already running at http://${host}:${port} — using that instance.`);
      openBrowser(`http://${host}:${port}`);
      session?.stopWatch(); // release the watcher started for this aborted launch
      return;
    }
    throw err;
  }

  const url = `http://${host}:${server.port}`;
  console.log(`[data-loom] dashboard ready at ${url}`);
  if (session) console.log(`[data-loom] project: ${session.project}`);
  openBrowser(url);

  // Tray icon: an ambient "DataLoom is running" indicator (essential in the
  // detached mode, which has no console). Guarded no-op where unavailable.
  let tray: Tray = { dispose: () => {} };

  const shutdown = (): void => {
    tray.dispose();
    session?.stopWatch();
    server?.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  tray = initTray({
    url,
    onOpen: () => launchBrowser(url),
    onCopy: () => copyToClipboard(url),
    onStop: shutdown,
    log: (msg) => console.error(msg),
  });
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
  // Detached background runs have no attached console and no user waiting at the
  // terminal, so never pop a browser for them (nor when explicitly suppressed).
  if (process.env.DATA_LOOM_NO_OPEN || process.env.DATA_LOOM_DETACHED) return;
  launchBrowser(url);
}

/** Open a URL in the default browser unconditionally (used by the tray). */
function launchBrowser(url: string): void {
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

/** Best-effort copy of text to the system clipboard; failure is silent. */
function copyToClipboard(text: string): void {
  try {
    const proc =
      process.platform === "win32"
        ? spawn("clip")
        : process.platform === "darwin"
          ? spawn("pbcopy")
          : spawn("xclip", ["-selection", "clipboard"]);
    proc.on("error", () => {});
    proc.stdin?.end(text);
  } catch {
    /* no clipboard tool available — non-fatal */
  }
}

// ---- CLI verb dispatch -----------------------------------------------------
// A leading reserved verb selects a lifecycle/autostart/integration command;
// anything else falls through to the foreground daemon (with argv[2] as the
// optional project path), preserving the original invocation unchanged.

const VERBS = new Set(["start", "stop", "restart", "status", "autostart", "connect", "disconnect"]);

async function runAutostart(rest: string[]): Promise<void> {
  const sub = rest[0];
  if (sub === "enable") {
    await autostart.enable();
    console.log("[data-loom] autostart enabled (launches on login)");
    // Enabling also brings the daemon up now, so it's running this session too —
    // opt out with --no-start.
    if (!rest.includes("--no-start")) await lifecycle.start();
    // ...and points Claude Code at it, so the always-on path both hosts and
    // registers the MCP endpoint. Best-effort: a missing `claude` CLI must not
    // fail the enable (the login item + daemon already succeeded). Opt out with
    // --no-connect.
    if (!rest.includes("--no-connect")) {
      try {
        await claudeCode.connect();
      } catch (err) {
        console.warn(
          `[data-loom] could not register with Claude Code (continuing): ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return;
  }
  if (sub === "disable") {
    await autostart.disable();
    console.log("[data-loom] autostart disabled");
    return;
  }
  if (sub === "status") {
    console.log(
      (await autostart.isEnabled())
        ? "[data-loom] autostart is enabled"
        : "[data-loom] autostart is not enabled",
    );
    return;
  }
  throw new Error("usage: data-loom autostart <enable|disable|status> [--no-start] [--no-connect]");
}

async function runConnect(rest: string[]): Promise<void> {
  const target = rest[0];
  if (target === "claude-code") {
    const registered = await claudeCode.connect();
    if (registered) {
      console.log("[data-loom] registered DataLoom in Claude Code (user scope, native HTTP)");
      console.log(
        "[data-loom] start a new Claude Code session (or /mcp reconnect) to pick it up; DataLoom must be running to serve the tools.",
      );
    }
    return;
  }
  if (target === "claude-desktop") {
    const bridge = rest.includes("--bridge");
    const path = await claudeDesktop.connect({ bridge });
    console.log(`[data-loom] registered DataLoom in Claude Desktop (${bridge ? "stdio bridge" : "native HTTP"}) — ${path}`);
    console.log("[data-loom] restart Claude Desktop to pick it up; DataLoom must be running to serve the tools.");
    return;
  }
  throw new Error("usage: data-loom connect <claude-code|claude-desktop [--bridge]>");
}

async function runDisconnect(rest: string[]): Promise<void> {
  const target = rest[0];
  if (target === "claude-code") {
    const { removed } = await claudeCode.disconnect();
    console.log(
      removed
        ? "[data-loom] removed DataLoom from Claude Code"
        : "[data-loom] DataLoom was not registered in Claude Code — nothing to remove",
    );
    return;
  }
  if (target === "claude-desktop") {
    const { path, removed } = await claudeDesktop.disconnect();
    console.log(
      removed
        ? `[data-loom] removed DataLoom from Claude Desktop — ${path}`
        : "[data-loom] DataLoom was not registered in Claude Desktop — nothing to remove",
    );
    return;
  }
  throw new Error("usage: data-loom disconnect <claude-code|claude-desktop>");
}

async function runCli(argv: string[]): Promise<void> {
  const [verb, ...rest] = argv;
  switch (verb) {
    case "start":
      return lifecycle.start(rest[0]);
    case "stop":
      return lifecycle.stop();
    case "restart":
      return lifecycle.restart(rest[0]);
    case "status":
      return lifecycle.status();
    case "autostart":
      return runAutostart(rest);
    case "connect":
      return runConnect(rest);
    case "disconnect":
      return runDisconnect(rest);
    default:
      throw new Error(`unknown command: ${verb}`);
  }
}

const cliArgs = process.argv.slice(2);
if (cliArgs[0] && VERBS.has(cliArgs[0])) {
  runCli(cliArgs).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
