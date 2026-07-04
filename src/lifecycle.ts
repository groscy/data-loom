// Background lifecycle for the daemon: start it detached, stop it, restart it,
// and report status. The loopback port is the authoritative "is it running?"
// signal — a stale PID file never blocks a start, because the source of truth is
// whether something actually answers on the port.

import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import { get, request } from "node:http";
import { HOST, PORT, baseUrl, logFile, pidFile, ensureStateDir } from "./paths.js";
import * as autostart from "./autostart.js";

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

/**
 * Write this process's own PID file. Used when running supervised (an OS
 * supervisor execs the daemon directly, so there is no parent `start` spawn
 * to record the child's PID) — keeps `status`/`stop` working the same
 * whether the daemon was launched via `start` or by a login supervisor.
 */
export async function writeSelfPid(): Promise<void> {
  await ensureStateDir();
  await writeFile(pidFile(), String(process.pid), "utf8");
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Ask the running daemon to shut itself down through its own graceful exit-0
 * path, via the loopback POST /api/shutdown. This is how a clean stop reaches
 * exit 0 on Windows, where `process.kill(pid, "SIGTERM")` force-terminates
 * (exit 1) without running the shutdown handler — which a supervising
 * Scheduled Task would misread as a crash and restart. Resolves true iff the
 * daemon accepted the request; false lets the caller fall back to a signal.
 */
function requestGracefulShutdown(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request(
      { host: HOST, port: PORT, path: "/api/shutdown", method: "POST", timeout: 2000 },
      (res) => {
        res.resume(); // drain
        resolve(res.statusCode === 200);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

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
  // On Linux, prefer stopping through systemd when the supervised unit is
  // active — keeps the unit's own state consistent with an intentional stop
  // rather than an out-of-band signal it has to interpret after the fact.
  if (await autostart.isSystemdUnitActive()) {
    await autostart.stopSystemdUnit();
  } else if (running && (await requestGracefulShutdown())) {
    // The daemon exits 0 through its own shutdown path — the only reliable way
    // to a clean exit on Windows (see requestGracefulShutdown). Nothing more to
    // signal; fall through to the port-free wait below.
  } else if (pid !== undefined) {
    // Fallback: no graceful endpoint answered (older daemon, or it's hung).
    // On POSIX this reaches the SIGTERM handler (exit 0); on Windows it force-
    // terminates (exit 1), which is still correct for an already-wedged daemon.
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
  const reg = await autostart.getRegistrationInfo();
  if (!reg.enabled) {
    console.log("[data-loom] autostart: not registered");
  } else {
    console.log(
      `[data-loom] autostart: ${reg.mechanism}${reg.supervised ? " (restarts automatically on crash)" : " (no restart supervision)"}`,
    );
  }
}

async function isGloballyInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("npm", ["ls", "-g", "@lyric_dev/data-loom", "--depth=0"], {
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

function npmInstallLatest(): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("npm", ["install", "-g", "@lyric_dev/data-loom@latest"], {
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`npm install exited with code ${code}`))));
  });
}

/**
 * Upgrade the globally-installed package, restart a running daemon, and
 * refresh the autostart registration (launcher + task/plist/unit) when one
 * exists — one command to land on the new version with a healthy always-on
 * setup. Aborts before any restart/registration step if the upgrade fails,
 * and never guesses at an upgrade mechanism for a non-global (e.g. npx) run.
 */
export async function update(): Promise<void> {
  if (!(await isGloballyInstalled())) {
    console.log("[data-loom] not installed globally, so it can't self-update.");
    console.log("[data-loom] run: npm install -g @lyric_dev/data-loom@latest");
    console.log("[data-loom] (or re-run npx @lyric_dev/data-loom@latest to pick up the new version)");
    return;
  }

  console.log("[data-loom] upgrading @lyric_dev/data-loom...");
  try {
    await npmInstallLatest();
  } catch (err) {
    console.error(`[data-loom] upgrade failed: ${err instanceof Error ? err.message : err}`);
    console.error("[data-loom] no restart or re-registration performed.");
    return;
  }
  console.log("[data-loom] upgrade complete.");

  if (await isRunning()) {
    console.log("[data-loom] restarting the daemon on the new version...");
    await restart();
  } else {
    console.log("[data-loom] no daemon running — nothing to restart.");
  }

  if (await autostart.isEnabled()) {
    console.log("[data-loom] refreshing the autostart registration...");
    const info = await autostart.enable();
    console.log(
      `[data-loom] autostart re-registered (${info.mechanism}${info.supervised ? ", supervised" : ", no restart supervision"})`,
    );
  } else {
    console.log("[data-loom] autostart not enabled — nothing to re-register.");
  }
}
