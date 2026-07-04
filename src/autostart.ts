// Per-user login autostart: register the background daemon to launch when the
// user logs in, using the native, no-elevation, per-user SUPERVISING
// mechanism for each OS —
//   Windows  a Scheduled Task (logon trigger, restart-on-failure)
//   macOS    a LaunchAgent plist with RunAtLoad + KeepAlive (crash-only)
//   Linux    a systemd user unit with Restart=on-failure
// Each of these executes the daemon directly (via the stable launcher below)
// in the FOREGROUND, so the supervisor tracks the daemon's own exit code and
// can restart it on crash — a launcher that detaches and returns (like `data-
// loom start`) would leave the supervisor watching nothing. When a platform's
// supervising mechanism can't be created or isn't available, registration
// falls back to the legacy, unsupervised form (Startup-folder shortcut /
// XDG autostart), which still launches the daemon via the normal detached
// `start` path. `enable()` migrates a legacy registration to the supervised
// form when possible; `disable()` removes both generations.

import { spawn } from "node:child_process";
import { writeFile, rm, access, mkdir, chmod, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { launcherFile, logFile, ensureStateDir } from "./paths.js";

const NODE = process.execPath;
const SCRIPT = process.argv[1];
const LABEL = "dev.lyric.data-loom";
const WIN_TASK_NAME = "DataLoom";
const SYSTEMD_UNIT_NAME = "data-loom.service";

export interface RegistrationInfo {
  enabled: boolean;
  /** Human-readable mechanism identifier, or "none" when not registered. */
  mechanism: "scheduled-task" | "launch-agent" | "systemd-unit" | "startup-shortcut" | "xdg-autostart" | "none";
  /** True iff the OS supervises the daemon and restarts it after a crash. */
  supervised: boolean;
}

export interface EnableResult {
  mechanism: RegistrationInfo["mechanism"];
  /** True iff the OS supervises the daemon and restarts it after a crash. */
  supervised: boolean;
  /**
   * True iff registering also launched the daemon immediately, so it's already
   * running this session — the supervised start-on-register mechanisms
   * (systemd `enable --now`, launchd `RunAtLoad`) do this, while the
   * logon/login-triggered ones (Windows Scheduled Task, the legacy shortcut /
   * XDG fallbacks) do not. Callers use this to avoid spawning a second instance
   * that would race the supervised one for the port.
   */
  startedNow: boolean;
}

function exists(p: string): Promise<boolean> {
  return access(p).then(
    () => true,
    () => false,
  );
}

/** Run a command, ignoring its outcome — used for best-effort teardown/reload steps. */
function runBestEffort(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { windowsHide: true, stdio: "ignore" });
    p.on("error", () => resolve());
    p.on("exit", () => resolve());
  });
}

/** Run a command and resolve true iff it exits 0 — used for existence/availability probes. */
function probe(cmd: string, args: string[], timeout?: number): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { windowsHide: true, stdio: "ignore", timeout });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

/**
 * Write the stable launcher that OS supervisors invoke. It resolves
 * `data-loom` from PATH at launch time, falling back to the node/script paths
 * recorded when this was written, so a Node version-manager switch or an npm
 * package relocation doesn't break the registration. It runs the daemon in
 * the FOREGROUND with `DATA_LOOM_DETACHED=1` (no browser, daemon writes its
 * own PID, output appended to the background log) and never backgrounds
 * itself — the supervisor must see the daemon's own exit code.
 */
export async function writeLauncher(): Promise<string> {
  await ensureStateDir();
  const path = launcherFile();
  const log = logFile();
  if (process.platform === "win32") {
    const script =
      "@echo off\r\n" +
      "set DATA_LOOM_DETACHED=1\r\n" +
      "where data-loom >nul 2>nul\r\n" +
      "if %ERRORLEVEL%==0 (\r\n" +
      `  data-loom >> "${log}" 2>&1\r\n` +
      ") else (\r\n" +
      `  "${NODE}" "${SCRIPT}" >> "${log}" 2>&1\r\n` +
      ")\r\n";
    await writeFile(path, script, "utf8");
  } else {
    const script =
      "#!/bin/sh\n" +
      "export DATA_LOOM_DETACHED=1\n" +
      "if command -v data-loom >/dev/null 2>&1; then\n" +
      `  exec data-loom >> "${log}" 2>&1\n` +
      "else\n" +
      `  exec "${NODE}" "${SCRIPT}" >> "${log}" 2>&1\n` +
      "fi\n";
    await writeFile(path, script, "utf8");
    await chmod(path, 0o755);
  }
  return path;
}

// ---- Windows: Scheduled Task (supervised) / Startup-folder shortcut (legacy) ----

function winStartupLnk(): string {
  const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  return join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "data-loom.lnk");
}

function runPowerShell(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, stdio: "ignore" },
    );
    ps.on("error", reject);
    ps.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`powershell exited ${code}`))));
  });
}

async function winScheduledTaskExists(): Promise<boolean> {
  return probe("schtasks", ["/Query", "/TN", WIN_TASK_NAME]);
}

async function winRegisterScheduledTask(): Promise<void> {
  const launcher = await writeLauncher();
  const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
  const script = [
    `$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c "' + ${q(launcher)} + '"')`,
    "$trigger = New-ScheduledTaskTrigger -AtLogOn",
    "$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries",
    `Register-ScheduledTask -TaskName ${q(WIN_TASK_NAME)} -Action $action -Trigger $trigger -Settings $settings -RunLevel Limited -Force | Out-Null`,
  ].join("; ");
  await runPowerShell(script);
}

/** Legacy, unsupervised registration — a plain Startup-folder shortcut running the normal detached `start`. */
async function winEnableLegacyShortcut(): Promise<void> {
  const lnk = winStartupLnk();
  await mkdir(dirname(lnk), { recursive: true });
  const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
  await runPowerShell(
    [
      "$s = (New-Object -ComObject WScript.Shell).CreateShortcut(" + q(lnk) + ")",
      "$s.TargetPath = " + q(NODE),
      "$s.Arguments = " + q(`"${SCRIPT}" start`),
      "$s.WindowStyle = 7",
      "$s.Description = 'DataLoom background daemon'",
      "$s.Save()",
    ].join("; "),
  );
}

async function winEnable(): Promise<EnableResult> {
  try {
    await winRegisterScheduledTask();
    // Migrate away from any legacy shortcut now that the supervised form exists.
    await rm(winStartupLnk(), { force: true }).catch(() => {});
    // The Scheduled Task fires on the next logon, not now — the caller still
    // needs to start the daemon for this session.
    return { mechanism: "scheduled-task", supervised: true, startedNow: false };
  } catch {
    // Scheduled Task creation failed (e.g. Task Scheduler service unavailable) —
    // fall back to the legacy shortcut so autostart still works, just unsupervised.
    await winEnableLegacyShortcut();
    return { mechanism: "startup-shortcut", supervised: false, startedNow: false };
  }
}

async function winDisable(): Promise<void> {
  await runBestEffort("schtasks", ["/Delete", "/TN", WIN_TASK_NAME, "/F"]);
  await rm(winStartupLnk(), { force: true }).catch(() => {});
}

async function winGetRegistrationInfo(): Promise<RegistrationInfo> {
  if (await winScheduledTaskExists()) return { enabled: true, mechanism: "scheduled-task", supervised: true };
  if (await exists(winStartupLnk())) return { enabled: true, mechanism: "startup-shortcut", supervised: false };
  return { enabled: false, mechanism: "none", supervised: false };
}

// ---- macOS: LaunchAgent (KeepAlive = supervised) ---------------------------

function macPlistPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

async function macEnable(): Promise<EnableResult> {
  const launcher = await writeLauncher();
  const path = macPlistPath();
  await mkdir(dirname(path), { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>${launcher}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
  </dict>
</dict>
</plist>
`;
  await writeFile(path, plist, "utf8");
  // Unload first (best-effort) so a rewritten KeepAlive setting actually takes
  // effect if the agent was already loaded from a prior (pre-supervision) version.
  await runBestEffort("launchctl", ["unload", "-w", path]);
  await runBestEffort("launchctl", ["load", "-w", path]);
  // `load -w` with RunAtLoad launches the daemon now, so it's already up this
  // session — the caller must not spawn a second instance that races it.
  return { mechanism: "launch-agent", supervised: true, startedNow: true };
}

async function macDisable(): Promise<void> {
  const path = macPlistPath();
  if (await exists(path)) {
    await runBestEffort("launchctl", ["unload", "-w", path]);
  }
  await rm(path, { force: true }).catch(() => {});
}

async function macGetRegistrationInfo(): Promise<RegistrationInfo> {
  const path = macPlistPath();
  if (!(await exists(path))) return { enabled: false, mechanism: "none", supervised: false };
  const content = await readFile(path, "utf8").catch(() => "");
  return { enabled: true, mechanism: "launch-agent", supervised: content.includes("KeepAlive") };
}

// ---- Linux: systemd user unit (supervised) / XDG autostart (legacy) -------

function linuxDesktopPath(): string {
  const cfg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(cfg, "autostart", "data-loom.desktop");
}

function systemdUnitDir(): string {
  return join(homedir(), ".config", "systemd", "user");
}

function systemdUnitPath(): string {
  return join(systemdUnitDir(), SYSTEMD_UNIT_NAME);
}

async function systemdUnitFileExists(): Promise<boolean> {
  return exists(systemdUnitPath());
}

/** Probe whether `systemctl --user` is usable (systemd present, user session/bus reachable). */
async function hasSystemdUserAvailable(): Promise<boolean> {
  return probe("systemctl", ["--user", "list-units", "--no-legend"], 3000);
}

/** True iff the supervised systemd unit is currently active — used by `stop` to avoid a raw SIGTERM racing systemd's own bookkeeping. */
export async function isSystemdUnitActive(): Promise<boolean> {
  if (process.platform !== "linux") return false;
  return probe("systemctl", ["--user", "is-active", "--quiet", SYSTEMD_UNIT_NAME]);
}

/** Stop the daemon through systemd rather than a raw signal, so the unit's state reflects an intentional stop. */
export async function stopSystemdUnit(): Promise<void> {
  await runBestEffort("systemctl", ["--user", "stop", SYSTEMD_UNIT_NAME]);
}

async function linuxSystemdEnable(): Promise<void> {
  const launcher = await writeLauncher();
  await mkdir(systemdUnitDir(), { recursive: true });
  const unit =
    "[Unit]\n" +
    "Description=DataLoom background daemon\n" +
    "\n" +
    "[Service]\n" +
    "Type=simple\n" +
    `ExecStart=${launcher}\n` +
    "Restart=on-failure\n" +
    "\n" +
    "[Install]\n" +
    "WantedBy=default.target\n";
  await writeFile(systemdUnitPath(), unit, "utf8");
  await runBestEffort("systemctl", ["--user", "daemon-reload"]);
  await runBestEffort("systemctl", ["--user", "enable", "--now", SYSTEMD_UNIT_NAME]);
}

/** Legacy, unsupervised registration — an XDG autostart entry running the normal detached `start`. */
async function linuxEnableXdg(): Promise<void> {
  await mkdir(dirname(linuxDesktopPath()), { recursive: true });
  const entry = `[Desktop Entry]
Type=Application
Name=DataLoom
Comment=DataLoom background daemon
Exec="${NODE}" "${SCRIPT}" start
X-GNOME-Autostart-enabled=true
`;
  await writeFile(linuxDesktopPath(), entry, "utf8");
}

async function linuxEnable(): Promise<EnableResult> {
  if (await hasSystemdUserAvailable()) {
    await linuxSystemdEnable();
    // Migrate away from any legacy XDG entry now that the supervised form exists.
    await rm(linuxDesktopPath(), { force: true }).catch(() => {});
    // `enable --now` starts the unit immediately, so the daemon is already up
    // this session — the caller must not spawn a second instance that races it.
    return { mechanism: "systemd-unit", supervised: true, startedNow: true };
  }
  // No systemd user session available — fall back to XDG autostart, unsupervised.
  // XDG entries only fire on the next login, so the caller still starts the
  // daemon for this session.
  await linuxEnableXdg();
  return { mechanism: "xdg-autostart", supervised: false, startedNow: false };
}

async function linuxDisable(): Promise<void> {
  if (await systemdUnitFileExists()) {
    await runBestEffort("systemctl", ["--user", "disable", "--now", SYSTEMD_UNIT_NAME]);
    await rm(systemdUnitPath(), { force: true }).catch(() => {});
    await runBestEffort("systemctl", ["--user", "daemon-reload"]);
  }
  await rm(linuxDesktopPath(), { force: true }).catch(() => {});
}

async function linuxGetRegistrationInfo(): Promise<RegistrationInfo> {
  if (await systemdUnitFileExists()) return { enabled: true, mechanism: "systemd-unit", supervised: true };
  if (await exists(linuxDesktopPath())) return { enabled: true, mechanism: "xdg-autostart", supervised: false };
  return { enabled: false, mechanism: "none", supervised: false };
}

// ---- Dispatch --------------------------------------------------------------

function unsupported(): never {
  throw new Error(`[data-loom] autostart is not supported on platform "${process.platform}"`);
}

/**
 * Register the daemon to launch at login (idempotent — overwrites any prior).
 * Prefers the OS's supervising mechanism so a crashed daemon restarts
 * automatically; falls back to the legacy, unsupervised form when the
 * supervising mechanism can't be created. Migrates away from a legacy
 * registration when the supervised form succeeds.
 */
export async function enable(): Promise<EnableResult> {
  if (process.platform === "win32") return winEnable();
  if (process.platform === "darwin") return macEnable();
  if (process.platform === "linux") return linuxEnable();
  unsupported();
}

/** Remove the login registration — both the supervised and any legacy form (idempotent). */
export async function disable(): Promise<void> {
  if (process.platform === "win32") return winDisable();
  if (process.platform === "darwin") return macDisable();
  if (process.platform === "linux") return linuxDisable();
  unsupported();
}

/** True iff a login registration currently exists for this user, of either generation. */
export async function isEnabled(): Promise<boolean> {
  return (await getRegistrationInfo()).enabled;
}

/** Full registration state: whether one exists, which mechanism, and whether it's supervised. */
export async function getRegistrationInfo(): Promise<RegistrationInfo> {
  if (process.platform === "win32") return winGetRegistrationInfo();
  if (process.platform === "darwin") return macGetRegistrationInfo();
  if (process.platform === "linux") return linuxGetRegistrationInfo();
  return { enabled: false, mechanism: "none", supervised: false };
}
