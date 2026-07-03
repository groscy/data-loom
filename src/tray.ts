// System-tray presence for the running daemon — a glanceable "is DataLoom
// running?" signal for the detached/background mode that has no console or
// window. Windows-first and dependency-free: a hidden PowerShell helper draws
// the DataLoom mark, shows a tooltip, and offers Open / Copy / Stop; menu
// clicks arrive back as stdout lines. Any failure (non-Windows, no PowerShell,
// headless/session-0, DATA_LOOM_NO_TRAY) is a silent no-op, so the tray never
// affects the daemon's ability to serve (mirror-not-launcher, DataLoom-only).

import { spawn, type ChildProcess } from "node:child_process";

export interface TrayOptions {
  /** Loopback URL the daemon serves, shown in the tooltip and opened/copied. */
  url: string;
  /** Open the dashboard (must open even in detached mode). */
  onOpen: () => void;
  /** Copy the URL to the clipboard (best-effort). */
  onCopy: () => void;
  /** Stop the daemon (routes through the same shutdown path as `stop`). */
  onStop: () => void;
  /** Optional sink for diagnostics (goes to the background log in detached mode). */
  log?: (msg: string) => void;
}

/** A live tray; `dispose()` removes the icon. Idempotent. */
export interface Tray {
  dispose: () => void;
}

const NOOP: Tray = { dispose: () => {} };

/**
 * Show a tray icon for the running daemon. Returns a disposer. Never throws:
 * on any unsupported/headless host or failure it returns a no-op tray so the
 * caller can wire it unconditionally.
 */
export function initTray(opts: TrayOptions): Tray {
  if (process.env.DATA_LOOM_NO_TRAY) return NOOP;
  // Windows-first: elsewhere (and headless) we degrade to no tray.
  if (process.platform !== "win32") return NOOP;
  try {
    return startWindowsTray(opts);
  } catch (err) {
    opts.log?.(`[data-loom] tray unavailable (continuing without it): ${err instanceof Error ? err.message : err}`);
    return NOOP;
  }
}

function startWindowsTray(opts: TrayOptions): Tray {
  const script = buildScript(opts.url, process.pid);
  // -EncodedCommand takes base64 of the UTF-16LE script, sidestepping all shell
  // quoting. powershell.exe (Windows PowerShell 5.1) runs STA, which WinForms
  // / NotifyIcon require.
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const child: ChildProcess = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );

  let disposed = false;
  child.stdout?.setEncoding("utf8");
  let buf = "";
  child.stdout?.on("data", (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      if (line === "open") opts.onOpen();
      else if (line === "copy") opts.onCopy();
      else if (line === "stop") opts.onStop();
    }
  });
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    // PowerShell serializes its progress/verbose streams to stderr as CLIXML
    // when piped (e.g. "Preparing modules for first use") — benign noise. Only
    // surface genuine error records.
    if (!/S="error"/i.test(chunk)) return;
    opts.log?.(`[data-loom] tray helper error: ${chunk.trim()}`);
  });
  child.on("error", (err) => opts.log?.(`[data-loom] tray helper error: ${err.message}`));

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      // Intentionally not killed here: the helper polls for its parent (this
      // daemon) and, once we exit, disposes its own NotifyIcon and quits — a
      // clean icon removal. A hard kill would skip that and leave a ghost icon
      // in the tray until the user hovers it. dispose() is only called during
      // shutdown, which exits the process immediately afterward.
      try {
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();
      } catch {
        /* nothing to clean up */
      }
    },
  };
}

/**
 * The PowerShell helper. Built as joined lines (no backticks, so it survives a
 * JS template context) with the URL and parent PID inlined. It draws the woven
 * DataLoom mark, shows a NotifyIcon with a tooltip and a context menu, reports
 * menu clicks on stdout, and self-terminates (removing its icon) as soon as the
 * parent daemon is gone.
 */
function buildScript(url: string, parentPid: number): string {
  const safeUrl = url.replace(/'/g, "''"); // single-quote escape for PS literal
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$url = '" + safeUrl + "'",
    "$parent = " + String(parentPid),
    // Draw the woven-lattice mark (faint horizontals + accent-blue verticals).
    "$bmp = New-Object System.Drawing.Bitmap 32,32",
    "$g = [System.Drawing.Graphics]::FromImage($bmp)",
    "$g.SmoothingMode = 'AntiAlias'",
    "$g.Clear([System.Drawing.Color]::Transparent)",
    "$accent = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255,37,99,184)), 2.4",
    "$faint = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255,144,163,190)), 2.4",
    "foreach ($y in 7,16,25) { $g.DrawLine($faint, 6, $y, 26, $y) }",
    "foreach ($x in 8,16,24) { $g.DrawLine($accent, $x, 6, $x, 26) }",
    "$g.Dispose()",
    "$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())",
    // Tray icon + tooltip.
    "$notify = New-Object System.Windows.Forms.NotifyIcon",
    "$notify.Icon = $icon",
    "$notify.Text = 'DataLoom - running - ' + $url",
    "$notify.Visible = $true",
    // Context menu — DataLoom-only actions, reported to the daemon on stdout.
    "$menu = New-Object System.Windows.Forms.ContextMenuStrip",
    "$mOpen = $menu.Items.Add('Open Dashboard')",
    "$mOpen.add_Click({ try { [Console]::Out.WriteLine('open'); [Console]::Out.Flush() } catch {} })",
    "$mCopy = $menu.Items.Add('Copy URL')",
    "$mCopy.add_Click({ try { [Console]::Out.WriteLine('copy'); [Console]::Out.Flush() } catch {} })",
    "$mStop = $menu.Items.Add('Stop DataLoom')",
    "$mStop.add_Click({ try { [Console]::Out.WriteLine('stop'); [Console]::Out.Flush() } catch {} })",
    "$notify.ContextMenuStrip = $menu",
    // Clean removal of the icon, however we exit.
    "$cleanup = { try { $notify.Visible = $false } catch {}; try { $notify.Dispose() } catch {}; try { $icon.Dispose() } catch {}; try { $bmp.Dispose() } catch {} }",
    // Pump WinForms messages (so the icon shows and the menu responds) while the
    // parent daemon is alive; when it goes, remove our icon and quit. A manual
    // DoEvents loop keeps $parent/$cleanup in the main scope, avoiding the scope
    // pitfalls of .NET event-handler scriptblocks. The menu handlers above use
    // only string literals, so they capture nothing.
    "try {",
    "  while (Get-Process -Id $parent -ErrorAction SilentlyContinue) {",
    "    [System.Windows.Forms.Application]::DoEvents()",
    "    Start-Sleep -Milliseconds 150",
    "  }",
    "} finally {",
    "  & $cleanup",
    "}",
  ].join("\n");
}
