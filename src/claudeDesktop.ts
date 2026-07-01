// Claude Desktop integration: register DataLoom's loopback MCP endpoint into
// Claude Desktop's claude_desktop_config.json so the same running daemon that
// serves Claude Code also serves Claude Desktop.
//
// By default we write the native remote/HTTP form (a URL entry) — no extra
// process, one daemon as the single source of truth. Claude Desktop versions
// without native remote support use the stdio bridge (`npx mcp-remote <url>`),
// which the caller forces with `--bridge`. Either way the daemon needs no change:
// it already permits native (no-Origin) MCP clients on loopback.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mcpUrl } from "./paths.js";

const KEY = "data-loom";

/** Per-OS location of Claude Desktop's config file. */
export function configPath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  const cfg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(cfg, "Claude", "claude_desktop_config.json");
}

type Config = { mcpServers?: Record<string, unknown> } & Record<string, unknown>;

/** Read + parse the config, or return {} when absent. Throws on malformed JSON. */
async function readConfig(path: string): Promise<Config> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return {};
  }
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("not a JSON object");
    }
    return parsed as Config;
  } catch (e) {
    throw new Error(
      `[data-loom] ${path} is not valid JSON (${e instanceof Error ? e.message : "parse error"}); ` +
        "fix or remove it, then retry — DataLoom will not overwrite it.",
    );
  }
}

async function writeConfig(path: string, cfg: Config): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** The MCP entry we register — native URL form by default, stdio bridge on demand. */
function entry(bridge: boolean): unknown {
  const url = mcpUrl();
  return bridge ? { command: "npx", args: ["-y", "mcp-remote", url] } : { type: "http", url };
}

/**
 * Add/update DataLoom's entry under mcpServers, preserving everything else.
 * Returns the path written so the caller can report it.
 */
export async function connect(opts: { bridge?: boolean } = {}): Promise<string> {
  const path = configPath();
  const cfg = await readConfig(path);
  cfg.mcpServers = { ...(cfg.mcpServers ?? {}), [KEY]: entry(opts.bridge ?? false) };
  await writeConfig(path, cfg);
  return path;
}

/**
 * Remove only DataLoom's entry. Idempotent — returns false when nothing was
 * registered (so the caller can say "nothing to remove").
 */
export async function disconnect(): Promise<{ path: string; removed: boolean }> {
  const path = configPath();
  const cfg = await readConfig(path);
  if (!cfg.mcpServers || !(KEY in cfg.mcpServers)) return { path, removed: false };
  delete cfg.mcpServers[KEY];
  await writeConfig(path, cfg);
  return { path, removed: true };
}
