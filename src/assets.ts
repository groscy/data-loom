// Static asset access that works both in development (read from public/ on
// disk) and in the packaged executable (read from embedded SEA assets).

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

type SeaModule = { isSea?: () => boolean; getRawAsset?: (key: string) => ArrayBuffer };

/** Dev location of the public/ directory (unused when running as a packaged exe). */
export function resolvePublicDir(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, "..", "public");
  } catch {
    return join(process.cwd(), "public");
  }
}

/**
 * Load a static asset by its relative key (e.g. "index.html").
 * Prefers embedded SEA assets when packaged; falls back to the filesystem.
 */
export async function loadAsset(rel: string, publicDir: string): Promise<Buffer | null> {
  try {
    const sea = (await import("node:sea")) as SeaModule;
    if (typeof sea.isSea === "function" && sea.isSea() && typeof sea.getRawAsset === "function") {
      try {
        return Buffer.from(sea.getRawAsset(rel));
      } catch {
        return null; // asset not embedded
      }
    }
  } catch {
    /* node:sea unavailable — development */
  }
  try {
    return await readFile(join(publicDir, rel));
  } catch {
    return null;
  }
}
