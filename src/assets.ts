// Static asset access: read the SPA's files from the public/ directory on disk.
// public/ is shipped alongside the compiled code in the published npm package.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Location of the public/ directory, resolved relative to the compiled module. */
export function resolvePublicDir(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, "..", "public");
  } catch {
    return join(process.cwd(), "public");
  }
}

/** Load a static asset by its relative key (e.g. "index.html") from publicDir. */
export async function loadAsset(rel: string, publicDir: string): Promise<Buffer | null> {
  try {
    return await readFile(join(publicDir, rel));
  } catch {
    return null;
  }
}
