// Shared config + per-user state locations for the daemon and its CLI verbs.
// The lifecycle commands (start/stop/status), autostart registration, and the
// Claude Desktop integration all need to agree on the loopback address, the
// state directory, and the PID/log paths — so they live here, in one place.

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Loopback host + port the daemon binds. Port overridable via env for tests. */
export const HOST = "127.0.0.1";
export const PORT = Number(process.env.PORT ?? 4317);

/** Dashboard base URL and the MCP endpoint hosted on the same authority. */
export const baseUrl = (): string => `http://${HOST}:${PORT}`;
export const mcpUrl = (): string => `${baseUrl()}/mcp`;

/**
 * Per-user state directory, using the OS convention:
 *   Windows  %LOCALAPPDATA%\data-loom
 *   macOS    ~/Library/Application Support/data-loom
 *   Linux    ${XDG_STATE_HOME:-~/.local/state}/data-loom
 * Holds the PID file and the background log — never the project dir.
 */
export function stateDir(): string {
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(local, "data-loom");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "data-loom");
  }
  const xdg = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  return join(xdg, "data-loom");
}

export const pidFile = (): string => join(stateDir(), "daemon.pid");
export const logFile = (): string => join(stateDir(), "daemon.log");

/** Create the state dir on demand; safe to call repeatedly. */
export async function ensureStateDir(): Promise<string> {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  return dir;
}
