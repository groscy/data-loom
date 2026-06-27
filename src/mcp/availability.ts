// Passive availability checks. NEVER spawns an MCP server or backing app —
// it only observes: connect to URL endpoints that already listen, and read the
// OS process table for stdio servers.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpLiveness, ProbeTarget } from "./types.js";

const execFileP = promisify(execFile);

export async function checkServer(target: ProbeTarget): Promise<McpLiveness> {
  if (target.transport === "stdio") {
    return (await isProcessRunning(target)) ? "already-running" : "on-demand";
  }
  if (target.url) {
    return checkUrl(target.url);
  }
  return "unknown";
}

/** Connect to an already-listening endpoint. Connecting is not launching. */
async function checkUrl(url: string): Promise<McpLiveness> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "manual" });
    if (res.status === 401 || res.status === 403) return "needs-auth";
    return "available";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort: is a process whose command line matches this stdio server running? */
async function isProcessRunning(target: ProbeTarget): Promise<boolean> {
  const needle = distinctive(target);
  if (!needle) return false;
  try {
    const lines = await processCommandLines();
    const n = needle.toLowerCase();
    return lines.some((l) => l.toLowerCase().includes(n));
  } catch {
    return false; // can't read the table -> resting state is on-demand
  }
}

/** The most identifying token: the longest non-flag argument, else the command. */
function distinctive(t: ProbeTarget): string | undefined {
  const args = (t.args ?? []).filter((a) => !a.startsWith("-")).sort((a, b) => b.length - a.length);
  return args[0] ?? t.command;
}

async function processCommandLines(): Promise<string[]> {
  if (process.platform === "win32") {
    const { stdout } = await execFileP(
      "powershell",
      ["-NoProfile", "-Command", "Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine"],
      { maxBuffer: 32 * 1024 * 1024, windowsHide: true },
    );
    return stdout.split(/\r?\n/);
  }
  const { stdout } = await execFileP("ps", ["-axww", "-o", "args="], { maxBuffer: 32 * 1024 * 1024 });
  return stdout.split(/\r?\n/);
}
