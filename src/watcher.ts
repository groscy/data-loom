// Watch the openspec/ directory and fire a debounced callback on any change.

import { watch } from "node:fs";
import { join } from "node:path";

export function watchOpenspec(
  repoRoot: string,
  onChange: () => void,
  debounceMs = 200,
): () => void {
  const dir = join(repoRoot, "openspec");
  let timer: NodeJS.Timeout | undefined;
  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, debounceMs);
  };

  let watcher;
  try {
    // Recursive watching is supported on Windows and macOS.
    watcher = watch(dir, { recursive: true }, trigger);
  } catch {
    // Fallback: shallow watch (e.g. Linux without recursive support).
    watcher = watch(dir, trigger);
  }

  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
