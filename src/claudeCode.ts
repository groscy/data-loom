// Claude Code integration: register DataLoom's loopback MCP endpoint with
// Claude Code at user (global) scope, so the same running daemon that serves
// the dashboard also serves a Claude Code session.
//
// Unlike the Claude Desktop integration (which edits a small, DataLoom-owned
// config file directly), this registers through Claude Code's OWN CLI
// (`claude mcp add`/`remove`). DataLoom never reads or writes `~/.claude.json`
// itself — that file holds OAuth tokens and per-project history and is written
// live by any running session, so its one owner (the `claude` CLI) serializes
// the write. When the `claude` CLI is missing, connect degrades to printing the
// manual command rather than failing hard.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mcpUrl } from "./paths.js";

const execFileP = promisify(execFile);

const KEY = "data-loom";

/** On Windows the CLI is a `.cmd`/`.ps1` shim, so it must be invoked through a shell. */
function runClaude(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileP("claude", args, { shell: process.platform === "win32" });
}

/** The registration command a user can run by hand when the `claude` CLI is absent. */
export function manualCommand(): string {
  return `claude mcp add --transport http --scope user ${KEY} ${mcpUrl()}`;
}

/** True iff the `claude` CLI is invocable (resolves its version). */
async function claudeAvailable(): Promise<boolean> {
  try {
    await runClaude(["--version"]);
    return true;
  } catch {
    return false;
  }
}

/** Remove any existing user-scope registration; tolerates "not registered". */
async function removeRegistration(): Promise<void> {
  try {
    await runClaude(["mcp", "remove", "--scope", "user", KEY]);
  } catch {
    /* not registered (or nothing to remove) — idempotent no-op */
  }
}

/**
 * Register DataLoom with Claude Code at user scope, pointing at the daemon's
 * loopback HTTP MCP endpoint. Idempotent upsert: remove any prior entry, then
 * add, so exactly one current entry remains. Returns false (with printed
 * guidance) when the `claude` CLI is unavailable, so callers can degrade
 * gracefully instead of failing.
 */
export async function connect(): Promise<boolean> {
  if (!(await claudeAvailable())) {
    console.log(
      "[data-loom] the `claude` CLI was not found — cannot register automatically.\n" +
        `[data-loom] register it by hand once with:\n    ${manualCommand()}`,
    );
    return false;
  }
  await removeRegistration();
  await runClaude(["mcp", "add", "--transport", "http", "--scope", "user", KEY, mcpUrl()]);
  return true;
}

/**
 * Remove DataLoom's user-scope registration from Claude Code. Idempotent —
 * reports whether anything was actually registered. Throws only if the `claude`
 * CLI itself is unavailable (nothing could have been registered without it).
 */
export async function disconnect(): Promise<{ removed: boolean }> {
  if (!(await claudeAvailable())) {
    throw new Error("the `claude` CLI was not found — nothing could have been registered");
  }
  // `claude mcp get <name>` exits non-zero when the entry is absent; use it to
  // report removed-vs-nothing without parsing `list` output.
  let existed = true;
  try {
    await runClaude(["mcp", "get", KEY]);
  } catch {
    existed = false;
  }
  await removeRegistration();
  return { removed: existed };
}
