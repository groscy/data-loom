#!/usr/bin/env node
// Refresh this machine's global install from the local source and restart the
// background daemon, so a release immediately serves the new code instead of a
// stale global copy (the daemon keeps running old dist files until reinstalled
// AND restarted). Runs automatically after `npm publish` (postpublish); can
// also be run manually at any commit: `npm run sync-global`.

import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

// 1. Build. Idempotent — after `npm publish` dist is already fresh via
//    prepublishOnly; this covers manual runs.
run("npm run build");

// 2. Pack to a temp tarball and install that globally. Installing the tarball
//    copies the files; `npm install -g <folder>` would only symlink the
//    working tree, leaving the "global" daemon coupled to this checkout.
const dir = mkdtempSync(join(tmpdir(), "data-loom-pack-"));
try {
  execSync(`npm pack --pack-destination "${dir}"`, { stdio: ["ignore", "ignore", "inherit"] });
  const tarball = readdirSync(dir).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball");
  run(`npm install -g "${join(dir, tarball)}"`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// 3. Restart the daemon through the freshly installed global CLI: the detached
//    child re-executes the CLI script that invoked it (see lifecycle.start), so
//    restarting via the global shim boots the new global dist — not this repo's.
const prefix = execSync("npm prefix -g", { encoding: "utf8" }).trim();
const bin =
  process.platform === "win32" ? join(prefix, "data-loom.cmd") : join(prefix, "bin", "data-loom");
run(`"${bin}" restart`);

console.log("[sync-global] global install refreshed and daemon restarted");
