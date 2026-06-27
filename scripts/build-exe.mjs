// Build a standalone Windows executable via Node's Single Executable Applications.
//   1. esbuild-bundle the ESM app to one CJS file (pulls in ws)
//   2. generate DataLoom.ico from public/icon.svg
//   3. embed public/ assets in a SEA config
//   4. generate the SEA blob, set the icon (rcedit), inject the blob (postject)
//
// `--bundle-only` stops after step 1 (useful for CI smoke tests / debugging).

import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import rcedit from "rcedit";

const bundleOnly = process.argv.includes("--bundle-only");
const OUT = "build";
const BUNDLE = join(OUT, "data-loom.cjs");
const CONFIG = join(OUT, "sea-config.json");
const BLOB = join(OUT, "sea-prep.blob");
const ICO = join(OUT, "DataLoom.ico");
const EXE = join(OUT, process.platform === "win32" ? "DataLoom.exe" : "DataLoom");
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
  define: { "import.meta.url": "importMetaUrl" },
  banner: { js: "const importMetaUrl = require('url').pathToFileURL(__filename).href;" },
  logLevel: "info",
});

if (bundleOnly) {
  console.log(`[package] bundle written to ${BUNDLE} (--bundle-only)`);
  process.exit(0);
}

console.log("[package] rendering app icon -> DataLoom.ico…");
const svg = readFileSync("public/icon.svg");
const sizes = [16, 32, 48, 64, 128, 256];
const pngs = await Promise.all(
  sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()),
);
writeFileSync(ICO, await pngToIco(pngs));

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
        "icon.svg": "public/icon.svg",
      },
    },
    null,
    2,
  ),
);

console.log("[package] generating SEA blob…");
execFileSync(process.execPath, ["--experimental-sea-config", CONFIG], { stdio: "inherit" });

console.log("[package] copying Node binary -> DataLoom.exe…");
copyFileSync(process.execPath, EXE);

if (process.platform === "win32") {
  console.log("[package] setting icon + version info (rcedit)…");
  await rcedit(EXE, {
    icon: ICO,
    "version-string": {
      ProductName: "DataLoom",
      FileDescription: "DataLoom — local spec-driven dashboard",
    },
  });
} else {
  console.log("[package] skipping rcedit (not Windows)");
}

console.log("[package] injecting blob with postject…");
execFileSync(
  process.execPath,
  [join("node_modules", "postject", "dist", "cli.js"), EXE, "NODE_SEA_BLOB", BLOB, "--sentinel-fuse", FUSE],
  { stdio: "inherit" },
);

console.log(`[package] done -> ${EXE}`);
