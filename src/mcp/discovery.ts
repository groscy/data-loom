// Merge MCP server definitions from Claude Code config sources into a single,
// de-duplicated, secret-free list. The hub is always Claude Code.

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import type { Discovery, McpScope, McpServer, McpTransport, ProbeTarget } from "./types.js";

interface RawCfg {
  type?: string;
  command?: string;
  args?: string[];
  url?: string;
  [k: string]: unknown;
}

export async function discover(repoRoot: string): Promise<Discovery> {
  const servers = new Map<string, McpServer>();
  const probes = new Map<string, ProbeTarget>();

  const add = (name: string, cfg: RawCfg, scope: McpScope, source: string): void => {
    const existing = servers.get(name);
    if (existing) {
      // Collapse duplicates; a project-scoped entry is the most specific.
      if (existing.scope === "project") return;
      if (scope === "global") return; // both global — keep the first
      // existing global + new project -> overwrite below
    }
    const { server, probe } = sanitize(name, cfg, scope, source);
    servers.set(name, server);
    probes.set(name, probe);
  };

  const home = homedir();
  const claudeJson = await readJsonSafe(join(home, ".claude.json"));
  const userMcp = await readJsonSafe(join(home, ".claude", ".mcp.json"));

  // Global: ~/.claude.json mcpServers
  for (const [n, c] of entriesOf(claudeJson?.mcpServers)) {
    if (isServerCfg(c)) add(n, c, "global", "~/.claude.json");
  }
  // Global/user: ~/.claude/.mcp.json (bare map or { mcpServers })
  const userServers = userMcp?.mcpServers ?? userMcp;
  for (const [n, c] of entriesOf(userServers)) {
    if (isServerCfg(c)) add(n, c, "global", "~/.claude/.mcp.json");
  }
  // Project: ~/.claude.json projects[<repoRoot>].mcpServers (match path variants)
  const target = normalizePath(repoRoot);
  for (const [p, pv] of entriesOf(claudeJson?.projects)) {
    if (normalizePath(p) !== target) continue;
    const ms = (pv as { mcpServers?: unknown })?.mcpServers;
    for (const [n, c] of entriesOf(ms)) {
      if (isServerCfg(c)) add(n, c, "project", `project: ${p}`);
    }
  }

  return { servers: [...servers.values()], probes };
}

function sanitize(
  name: string,
  cfg: RawCfg,
  scope: McpScope,
  source: string,
): { server: McpServer; probe: ProbeTarget } {
  const transport = transportOf(cfg);
  const probe: ProbeTarget = { name, transport, command: cfg.command, args: cfg.args, url: cfg.url };
  const server: McpServer = { name, transport, scope, source, liveness: "unknown" };
  if (transport === "stdio") {
    server.command = cfg.command ? basename(cfg.command) : undefined;
    server.detail = redactArgs(cfg.args);
  } else {
    server.url = safeUrl(cfg.url);
    server.detail = server.url;
  }
  return { server, probe };
}

function transportOf(cfg: RawCfg): McpTransport {
  if (cfg.type === "http" || cfg.type === "streamable-http") return "http";
  if (cfg.type === "sse") return "sse";
  if (cfg.type === "stdio") return "stdio";
  if (cfg.command) return "stdio";
  if (cfg.url) return "http";
  return "unknown";
}

function isServerCfg(c: unknown): c is RawCfg {
  return !!c && typeof c === "object" && ("command" in c || "url" in c || "type" in c);
}

// --- redaction (secrets must never reach the client) ---

function redactArgs(args?: string[]): string {
  if (!args || !args.length) return "";
  const sensitiveFlag = /(token|secret|key|password|passwd|auth|bearer|cred)/i;
  const tokenish = /^(ghp_|gho_|sk-|xox|eyJ)|^[A-Fa-f0-9]{24,}$/;
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (sensitiveFlag.test(args[i - 1] ?? "") || tokenish.test(a)) out.push("***");
    else if (/^https?:\/\//i.test(a)) out.push(safeUrl(a));
    else out.push(a);
  }
  return out.join(" ").slice(0, 100);
}

function safeUrl(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function entriesOf(v: unknown): Array<[string, unknown]> {
  return v && typeof v === "object" ? Object.entries(v as Record<string, unknown>) : [];
}

async function readJsonSafe(path: string): Promise<Record<string, any> | null> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}
