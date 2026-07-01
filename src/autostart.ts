// Per-user login autostart: register the background daemon to launch when the
// user logs in, using the native, no-elevation mechanism for each OS —
//   Windows  a shortcut in the per-user Startup folder
//   macOS    a LaunchAgent plist with RunAtLoad
//   Linux    an XDG autostart .desktop entry
// Every registration launches `<node> <script> start`, so a login-triggered
// launch shares the exact same detached/single-instance/logging path as a
// manual `data-loom start`.

import { spawn } from "node:child_process";
import { writeFile, rm, access, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const NODE = process.execPath;
const SCRIPT = process.argv[1];
const LABEL = "dev.lyric.data-loom";

function exists(p: string): Promise<boolean> {
  return access(p).then(
    () => true,
    () => false,
  );
}

// ---- Windows: Startup-folder shortcut -------------------------------------

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

async function winEnable(): Promise<void> {
  const lnk = winStartupLnk();
  await mkdir(dirname(lnk), { recursive: true });
  // Create the .lnk via WScript.Shell; WindowStyle 7 = minimized so the brief
  // launcher console doesn't grab focus (the daemon itself is detached).
  const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
  await runPowerShell(
    [
      "$s = (New-Object -ComObject WScript.Shell).CreateShortcut(" + q(lnk) + ")",
      "$s.TargetPath = " + q(NODE),
      '$s.Arguments = ' + q(`"${SCRIPT}" start`),
      "$s.WindowStyle = 7",
      "$s.Description = 'DataLoom background daemon'",
      "$s.Save()",
    ].join("; "),
  );
}

async function winDisable(): Promise<void> {
  await rm(winStartupLnk(), { force: true }).catch(() => {});
}

// ---- macOS: LaunchAgent ----------------------------------------------------

function macPlistPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

async function macEnable(): Promise<void> {
  const path = macPlistPath();
  await mkdir(dirname(path), { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE}</string>
    <string>${SCRIPT}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`;
  await writeFile(path, plist, "utf8");
  await new Promise<void>((resolve) => {
    const p = spawn("launchctl", ["load", "-w", path], { stdio: "ignore" });
    p.on("error", () => resolve()); // best-effort; the plist is written regardless
    p.on("exit", () => resolve());
  });
}

async function macDisable(): Promise<void> {
  const path = macPlistPath();
  if (await exists(path)) {
    await new Promise<void>((resolve) => {
      const p = spawn("launchctl", ["unload", "-w", path], { stdio: "ignore" });
      p.on("error", () => resolve());
      p.on("exit", () => resolve());
    });
  }
  await rm(path, { force: true }).catch(() => {});
}

// ---- Linux: XDG autostart --------------------------------------------------

function linuxDesktopPath(): string {
  const cfg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(cfg, "autostart", "data-loom.desktop");
}

async function linuxEnable(): Promise<void> {
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

async function linuxDisable(): Promise<void> {
  await rm(linuxDesktopPath(), { force: true }).catch(() => {});
}

// ---- Dispatch --------------------------------------------------------------

function unsupported(): never {
  throw new Error(`[data-loom] autostart is not supported on platform "${process.platform}"`);
}

/** Register the daemon to launch at login (idempotent — overwrites any prior). */
export async function enable(): Promise<void> {
  if (process.platform === "win32") return winEnable();
  if (process.platform === "darwin") return macEnable();
  if (process.platform === "linux") return linuxEnable();
  unsupported();
}

/** Remove the login registration (idempotent — succeeds when not enabled). */
export async function disable(): Promise<void> {
  if (process.platform === "win32") return winDisable();
  if (process.platform === "darwin") return macDisable();
  if (process.platform === "linux") return linuxDisable();
  unsupported();
}

/** True iff a login registration currently exists for this user. */
export async function isEnabled(): Promise<boolean> {
  if (process.platform === "win32") return exists(winStartupLnk());
  if (process.platform === "darwin") return exists(macPlistPath());
  if (process.platform === "linux") return exists(linuxDesktopPath());
  return false;
}
