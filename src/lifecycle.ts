// Background lifecycle for the daemon: start it detached, stop it, restart it,
// and report status. The loopback port is the authoritative "is it running?"
// signal — a stale PID file never blocks a start, because the source of truth is
// whether something actually answers on the port.

import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import { get } from "node:http";
import { HOST, PORT, baseUrl, logFile, pidFile, ensureStateDir } from "./paths.js";

/** Probe the loopback endpoint; true iff a daemon answers within the timeout. */
export function isRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = get(
      { host: HOST, port: PORT, path: "/api/model", timeout: 1000 },
      (res) => {
        res.resume(); // drain
        resolve(true);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function readPid(): Promise<number | undefined> {
  try {
    const n = Number((await readFile(pidFile(), "utf8")).trim());
    return Number.isInteger(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Start the daemon detached from this terminal. If one already answers on the
 * port, this is a reported no-op (single-instance guard). The child re-runs this
 * same entry point in the foreground with DATA_LOOM_DETACHED set so it skips the
 * browser and logs to the state-dir log file.
 */
export async function start(project?: string): Promise<void> {
  if (await isRunning()) {
    console.log(`[data-loom] already running — ${baseUrl()}`);
    return;
  }
  await ensureStateDir();
  const out = openSync(logFile(), "a");
  const args = [process.argv[1], ...(project ? [project] : [])];
  const child = spawn(process.execPath, args, {
    detached: true,
    windowsHide: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, DATA_LOOM_DETACHED: "1" },
  });
  child.unref();
  if (child.pid) await writeFile(pidFile(), String(child.pid), "utf8");
  console.log(`[data-loom] started in background (pid ${child.pid ?? "?"}) — ${baseUrl()}`);
  console.log(`[data-loom] logs: ${logFile()}`);
}

/** Stop the background daemon; a no-op (with notice) when nothing is running. */
export async function stop(): Promise<void> {
  const pid = await readPid();
  const running = await isRunning();
  if (!running && pid === undefined) {
    console.log("[data-loom] not running — nothing to stop");
    return;
  }
  if (pid !== undefined) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  } else if (running) {
    console.error("[data-loom] a daemon is answering the port but no PID file was found; stop it manually");
    return;
  }
  // Wait for the port to actually free (up to ~5s), then drop the PID file.
  for (let i = 0; i < 25 && (await isRunning()); i++) await delay(200);
  await rm(pidFile(), { force: true }).catch(() => {});
  console.log("[data-loom] stopped");
}

/** Restart: stop any running instance, then start a fresh one. */
export async function restart(project?: string): Promise<void> {
  await stop();
  await start(project);
}

/** Report whether the daemon is running, and where to reach it / find its logs. */
export async function status(): Promise<void> {
  if (await isRunning()) {
    const pid = await readPid();
    console.log(`[data-loom] running — ${baseUrl()}${pid !== undefined ? ` (pid ${pid})` : ""}`);
    console.log(`[data-loom] logs: ${logFile()}`);
  } else {
    console.log("[data-loom] not running");
  }
}
