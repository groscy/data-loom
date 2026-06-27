// Build a standalone Windows executable via Node's Single Executable Applications.
//   1. esbuild-bundle the ESM app to one CJS file (pulls in ws)
//   2. embed public/ assets in a SEA config
//   3. generate the SEA blob and inject it into a copy of the Node binary
//
// `--bundle-only` stops after step 1 (useful for CI smoke tests / debugging).

import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const bundleOnly = process.argv.includes("--bundle-only");
const OUT = "build";
const BUNDLE = join(OUT, "data-loom.cjs");
const CONFIG = join(OUT, "sea-config.json");
const BLOB = join(OUT, "sea-prep.blob");
const EXE = join(OUT, process.platform === "win32" ? "data-loom.exe" : "data-loom");
const FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

mkdirSync(OUT, { recursive: true });

console.log("[package] bundling app with esbuild…");
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: BUNDLE,
  // Make ESM `import.meta.url` work in the CJS bundle.
  define: { "import.meta.url": "importMetaUrl" },
  banner: { js: "const importMetaUrl = require('url').pathToFileURL(__filename).href;" },
  logLevel: "info",
});

if (bundleOnly) {
  console.log(`[package] bundle written to ${BUNDLE} (--bundle-only)`);
  process.exit(0);
}

console.log("[package] writing SEA config with embedded assets…");
writeFileSync(
  CONFIG,
  JSON.stringify(
    {
      main: BUNDLE,
      output: BLOB,
      disableExperimentalSEAWarning: true,
      assets: {
        "index.html": "public/index.html",
        "app.js": "public/app.js",
        "style.css": "public/style.css",
      },
    },
    null,
    2,
  ),
);

console.log("[package] generating SEA blob…");
execFileSync(process.execPath, ["--experimental-sea-config", CONFIG], { stdio: "inherit" });

console.log("[package] copying Node binary…");
copyFileSync(process.execPath, EXE);

console.log("[package] injecting blob with postject…");
execFileSync(
  process.execPath,
  [
    join("node_modules", "postject", "dist", "cli.js"),
    EXE,
    "NODE_SEA_BLOB",
    BLOB,
    "--sentinel-fuse",
    FUSE,
  ],
  { stdio: "inherit" },
);

console.log(`[package] done -> ${EXE}`);
