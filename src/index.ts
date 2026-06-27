#!/usr/bin/env node
// data_loom daemon entry point: verify the openspec CLI, derive the roadmap,
// discover the MCP setup, serve the SPA, and keep it live.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OpenSpecClient } from "./openspecClient.js";
import { deriveModel } from "./derive.js";
import { watchOpenspec } from "./watcher.js";
import { startServer, type RunningServer } from "./server.js";
import { discover } from "./mcp/discovery.js";
import { checkServer } from "./mcp/availability.js";
import type { RoadmapModel } from "./types.js";
import type { McpModel, McpServer, ProbeTarget } from "./mcp/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.DATA_LOOM_ROOT ?? process.cwd();
const publicDir = join(here, "..", "public");
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4317);

async function main(): Promise<void> {
  const client = new OpenSpecClient(repoRoot);

  // Fail loudly if the openspec CLI is missing, rather than serving a blank roadmap.
  try {
    const version = await client.checkAvailable();
    console.log(`[data-loom] openspec CLI ${version}`);
  } catch {
    console.error(
      "[data-loom] ERROR: the `openspec` CLI is not available on PATH.\n" +
        "data_loom reads the workspace through it — install openspec and retry.",
    );
    process.exit(1);
  }

  // --- roadmap (WHAT) ---
  let model: RoadmapModel | null = null;
  let server: RunningServer | undefined;

  const recompute = async (): Promise<void> => {
    try {
      model = await deriveModel(client);
      server?.broadcast({ type: "model", model });
      const active = model.changes.filter((c) => !c.archived).length;
      console.log(`[data-loom] roadmap recomputed — ${active} change(s), ${model.phases.length} phase(s)`);
    } catch (err) {
      console.error("[data-loom] derivation failed:", err);
    }
  };

  // --- MCP topology (HOW) ---
  let mcpServers: McpServer[] = [];
  let probes = new Map<string, ProbeTarget>();
  try {
    const disc = await discover(repoRoot);
    mcpServers = disc.servers;
    probes = disc.probes;
    console.log(`[data-loom] discovered ${mcpServers.length} MCP server(s)`);
  } catch (err) {
    console.error("[data-loom] MCP discovery failed:", err);
  }

  const getMcp = (): McpModel => ({ hub: "Claude Code", servers: mcpServers });
  const checkMcp = async (name: string): Promise<McpServer | null> => {
    const target = probes.get(name);
    const sv = mcpServers.find((s) => s.name === name);
    if (!target || !sv) return null;
    sv.liveness = await checkServer(target);
    sv.lastChecked = new Date().toISOString();
    return sv;
  };

  model = await deriveModel(client);
  server = await startServer({ publicDir, host, port, getRoadmap: () => model, getMcp, checkMcp });
  const stopWatch = watchOpenspec(repoRoot, recompute);

  console.log(`[data-loom] dashboard ready at http://${host}:${server.port}`);
  console.log(`[data-loom] watching ${join(repoRoot, "openspec")}`);

  const shutdown = (): void => {
    stopWatch();
    server?.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
