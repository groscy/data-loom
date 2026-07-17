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
import { provisionWeaveAlias, removeWeaveAliasIfOurs } from "./weaveAlias.js";
import { VERSION } from "./version.js";

const execFileP = promisify(execFile);

const KEY = "data-loom";

// The on-demand form registers this PATH command (never node+script — same
// stable-launcher reasoning as autostart's supervised launcher), which starts
// the daemon if needed and proxies to it for the session (see mcpShim.ts).
const SHIM_COMMAND = "data-loom";
const SHIM_ARGS = ["mcp-shim"];

export type RegistrationForm = "http" | "stdio";

export interface ConnectResult {
  registered: boolean;
  /** Set when a registration of the other form existed and was replaced. */
  switchedFrom?: RegistrationForm;
}

/**
 * On Windows the CLI is a `.cmd`/`.ps1` shim, so it must be invoked through a
 * shell; `windowsHide` stops that shell's console window from flashing to the
 * foreground and stealing focus when the daemon runs headless.
 */
function runClaude(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileP("claude", args, { shell: process.platform === "win32", windowsHide: true });
}

/** The registration command a user can run by hand when the `claude` CLI is absent. */
export function manualCommand(onDemand = false): string {
  return onDemand
    ? `claude mcp add --scope user ${KEY} -- ${SHIM_COMMAND} ${SHIM_ARGS.join(" ")}`
    : `claude mcp add --transport http --scope user ${KEY} ${mcpUrl()}`;
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

/**
 * The form of the current `data-loom` registration, or undefined when there is
 * none (or it can't be determined). Parsed from `claude mcp get`'s human-
 * readable output, so this is best-effort — used only to report a form switch
 * to the user, never to decide correctness (removeRegistration + add below
 * guarantees a single entry regardless).
 */
async function currentForm(): Promise<RegistrationForm | undefined> {
  try {
    const { stdout } = await runClaude(["mcp", "get", KEY]);
    const m = /^\s*Type:\s*(\S+)/im.exec(stdout);
    if (!m) return undefined;
    return m[1].toLowerCase() === "stdio" ? "stdio" : "http";
  } catch {
    return undefined; // not registered, or `claude mcp get` itself failed
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
 * Register DataLoom with Claude Code at user scope: by default the daemon's
 * loopback HTTP MCP endpoint, or — with `onDemand` — the stdio shim that
 * starts the daemon itself when needed. Idempotent upsert: remove any prior
 * entry (of either form), then add, so exactly one current entry remains;
 * when a registration of the other form existed, `switchedFrom` reports it.
 * Returns `registered: false` (with printed guidance) when the `claude` CLI is
 * unavailable, so callers can degrade gracefully instead of failing.
 *
 * Also provisions the `/loom:weave` alias, best-effort: a failure to write it
 * warns but does not fail the connect, since the MCP registration is the
 * primary outcome.
 */
export async function connect(opts: { onDemand?: boolean } = {}): Promise<ConnectResult> {
  const onDemand = opts.onDemand ?? false;
  if (!(await claudeAvailable())) {
    console.log(
      "[data-loom] the `claude` CLI was not found — cannot register automatically.\n" +
        `[data-loom] register it by hand once with:\n    ${manualCommand(onDemand)}`,
    );
    return { registered: false };
  }
  const existingForm = await currentForm();
  await removeRegistration();
  if (onDemand) {
    await runClaude(["mcp", "add", "--scope", "user", KEY, "--", SHIM_COMMAND, ...SHIM_ARGS]);
  } else {
    await runClaude(["mcp", "add", "--transport", "http", "--scope", "user", KEY, mcpUrl()]);
  }
  try {
    await provisionWeaveAlias(VERSION);
  } catch (err) {
    console.warn(
      `[data-loom] could not write the /loom:weave command (continuing): ${err instanceof Error ? err.message : err}`,
    );
  }
  const requestedForm: RegistrationForm = onDemand ? "stdio" : "http";
  return {
    registered: true,
    switchedFrom: existingForm && existingForm !== requestedForm ? existingForm : undefined,
  };
}

/**
 * Remove DataLoom's user-scope registration from Claude Code, whichever form
 * (HTTP or on-demand stdio) is present — `claude mcp remove` deletes the entry
 * by name only, so this is form-agnostic already. Idempotent — reports whether
 * anything was actually registered. Throws only if the `claude` CLI itself is
 * unavailable (nothing could have been registered without it).
 *
 * Also removes the `/loom:weave` alias, but only when its version stamp
 * identifies it as ours — a file we don't recognize is left untouched. This is
 * best-effort like the alias write in connect().
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
  try {
    await removeWeaveAliasIfOurs();
  } catch (err) {
    console.warn(
      `[data-loom] could not remove the /loom:weave command (continuing): ${err instanceof Error ? err.message : err}`,
    );
  }
  return { removed: existed };
}
