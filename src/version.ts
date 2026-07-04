// The advertised package version — read from the manifest shipped next to the
// compiled code, so it can never drift from the released version again (it was
// hardcoded in mcpServer.ts and stuck at 0.4.1 through the 0.5.0 release).
// Shared by the MCP server (server version), the weave alias (version stamp),
// and the startup refresh (comparing stamps).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION = ((): string => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return manifest.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
