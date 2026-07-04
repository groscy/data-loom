// Shared provisioning for the `/loom:weave` alias: a thin, version-stamped
// command file that delegates to the data-loom MCP server's `weave` prompt
// (see mcpServer.ts) instead of carrying the workflow text itself. Written by
// the install_weave_skill tool, `connect claude-code`, and healed on daemon
// startup — all three must agree on path, stamp format, and template, so it
// lives here rather than duplicated across callers.

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const WEAVE_ALIAS_PATH = join(homedir(), ".claude", "commands", "loom", "weave.md");

const STAMP_RE = /<!--\s*data-loom:version\s+(\S+?)\s*-->/;

function buildAlias(version: string): string {
  return `---
name: "Loom: Weave"
description: "Review the open proposals and weave their dependency order via the data-loom MCP server"
category: Workflow
tags: [loom, dependencies, mcp, review]
---

<!-- data-loom:version ${version} -->

Fetch the **data-loom** MCP server's \`weave\` prompt (\`prompts/get\` with name \`weave\`) and follow it exactly — that prompt is this workflow's single source of truth and always matches the running server.

**If the data-loom tools or the \`weave\` prompt are unreachable:** the daemon is almost certainly not running or not registered in this session. Tell the user to check \`data-loom status\`, start it with \`data-loom start\` if it isn't running, and register it with \`data-loom connect claude-code\` if it isn't registered — then retry.
`;
}

async function readAlias(): Promise<string | null> {
  try {
    return await readFile(WEAVE_ALIAS_PATH, "utf8");
  } catch {
    return null;
  }
}

/** Write the current alias, creating its parent directory if absent. Returns the path written. */
export async function provisionWeaveAlias(version: string): Promise<string> {
  await mkdir(dirname(WEAVE_ALIAS_PATH), { recursive: true });
  await writeFile(WEAVE_ALIAS_PATH, buildAlias(version));
  return WEAVE_ALIAS_PATH;
}

/**
 * On daemon startup: rewrite an existing alias whose version stamp is missing
 * or does not match the running version (covers both a prior version's alias
 * and a pre-prompt full-text install, which predates the stamp). Never creates
 * the file — absence means the user hasn't opted in via connect or the tool.
 */
export async function refreshWeaveAliasIfOutdated(version: string): Promise<void> {
  const text = await readAlias();
  if (text === null) return;
  if (text.match(STAMP_RE)?.[1] === version) return;
  await provisionWeaveAlias(version);
}

/**
 * Remove the alias only when it carries a data-loom version stamp — our
 * positive signal of ownership. A file with no stamp at all (or no file) is
 * left untouched. Returns whether a file was removed.
 */
export async function removeWeaveAliasIfOurs(): Promise<boolean> {
  const text = await readAlias();
  if (text === null || !STAMP_RE.test(text)) return false;
  await unlink(WEAVE_ALIAS_PATH);
  return true;
}
