// data_loom as an MCP server: exposes the open proposals (read) and a
// dependency-writing action (write `## Depends On`) so an MCP client — the
// user's own authenticated Claude — can determine and apply the order.
// Holds no credentials; tools carry only proposal text and change names.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { OpenSpecClient } from "./openspecClient.js";
import { deriveModel } from "./derive.js";
import type { ChangeNode } from "./types.js";

// Advertised to the client on connect. The "confirm before writing" gate lives
// here, in the agent's behavior — the server cannot verify a human approved.
const INSTRUCTIONS = `This server exposes a project's open OpenSpec proposals and lets you record the dependency order between them. It holds no model and cannot infer anything on its own — the judgment is yours and the decision is the user's.

When you connect, call list_open_proposals and look at each proposal's "dependencyReview" field. For every proposal whose state is "pending" (it has no \`## Depends On\` declaration yet):
  1. Read its proposal text alongside the others and reason about which changes it should be implemented after.
  2. PROPOSE the dependencies — or that it is independent — to the user in plain language, with your reasoning.
  3. Only AFTER the user confirms, record the result: call set_dependency(from, to) for each confirmed edge, or mark_independent(change) for a change that genuinely depends on nothing.

Never write a dependency the user has not confirmed. Proposals already marked "declared" need no action.

Tip: call install_weave_skill once to add a \`/loom:weave\` command (written to the user's global Claude config) that runs this whole review in one step; the user reloads Claude Code to pick it up.`;

// The `/loom:weave` slash command this server installs into the user's global
// Claude commands dir. Static content that only orchestrates this server's tools.
const WEAVE_COMMAND = `---
name: "Loom: Weave"
description: "Review the open proposals and weave their dependency order via the data-loom MCP server"
category: Workflow
tags: [loom, dependencies, mcp, review]
---

Weave the dependency order of this project's open OpenSpec proposals, using the **data-loom** MCP server.

**Prerequisite:** the data-loom MCP server must be registered in this session — its tools are \`list_open_proposals\`, \`set_dependency\`, and \`mark_independent\`. If those tools are not available, tell the user to register it (\`claude mcp add data-loom -- DataLoom.exe mcp "<project path>"\`) and stop.

Steps:

1. Call \`list_open_proposals\` and note each proposal's \`dependencyReview\` state.
2. Focus on the proposals whose state is \`pending\` (no \`## Depends On\` declaration yet). Proposals already \`declared\` need no action — leave them alone.
3. Read the pending proposals alongside the others. Reason about which change should be implemented **after** which, from their capabilities and content: a change that extends or modifies what another change introduces depends on it; changes that touch disjoint areas are independent.
4. **Propose** your conclusion to the user in plain language — for each pending proposal, the dependencies you would record (or that it is independent), each with a one-line reason. Do not write anything yet.
5. **Wait for the user to confirm.** Never write a dependency the user has not approved.
6. After the user confirms, record it:
   - \`set_dependency(from, to)\` for each confirmed edge (the dependent is \`from\`).
   - \`mark_independent(change)\` for a proposal the user confirms depends on nothing.
7. Call \`list_open_proposals\` again and report the resulting phases — what moved, and what is now ready versus blocked.

The reasoning stays the user's to approve: you surface and apply, the user decides.
`;

export async function runMcpServer(project: string): Promise<void> {
  const client = new OpenSpecClient(project);
  const changesDir = join(project, "openspec", "changes");

  const server = new Server(
    { name: "data-loom", version: "0.2.2" },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_open_proposals",
        description:
          "List the open (non-archived) OpenSpec proposals for this project, each with its proposal text (Why / What Changes / Capabilities) and currently derived dependencies, phase, and readiness. Use this to reason about which proposals should be implemented after which.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "set_dependency",
        description:
          "Declare that one open proposal depends on (should be implemented after) another by writing a `## Depends On` entry into the dependent's proposal. The roadmap then recomputes deterministically from that file.",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "The dependent change (gets the `## Depends On` entry)" },
            to: { type: "string", description: "The change it depends on" },
          },
          required: ["from", "to"],
          additionalProperties: false,
        },
      },
      {
        name: "mark_independent",
        description:
          "Record that an open proposal depends on nothing by writing an empty `## Depends On` declaration into it. Use this — only after the user confirms — for a change that is genuinely parallel, so it moves from `pending` to `declared` dependency review without adding any edge. Validates the change is a known open change and is idempotent.",
        inputSchema: {
          type: "object",
          properties: {
            change: { type: "string", description: "The open change to mark as having no dependencies" },
          },
          required: ["change"],
          additionalProperties: false,
        },
      },
      {
        name: "install_weave_skill",
        description:
          "Install the `/loom:weave` slash command into the user's global Claude commands directory (~/.claude/commands/loom/weave.md), so this dependency review can be run as a single command from any project where this server is registered. Writes a static command file only (no project data or secrets) and overwrites any existing copy. Run once, then the user reloads Claude Code.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      if (name === "list_open_proposals") {
        return ok(await listOpenProposals(client, changesDir));
      }
      if (name === "set_dependency") {
        const from = String((args as Record<string, unknown>)?.from ?? "");
        const to = String((args as Record<string, unknown>)?.to ?? "");
        return ok(await setDependency(client, changesDir, from, to));
      }
      if (name === "mark_independent") {
        const change = String((args as Record<string, unknown>)?.change ?? "");
        return ok(await markIndependent(client, changesDir, change));
      }
      if (name === "install_weave_skill") {
        return ok(await installWeaveSkill());
      }
      return err(`unknown tool: ${name}`);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  await server.connect(new StdioServerTransport());
  // Logs go to stderr so they don't corrupt the stdio JSON-RPC channel.
  console.error(`[data-loom mcp] serving project ${project}`);
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

async function openChanges(client: OpenSpecClient): Promise<ChangeNode[]> {
  const model = await deriveModel(client);
  return model.changes.filter((c) => !c.archived);
}

async function listOpenProposals(client: OpenSpecClient, changesDir: string) {
  const changes = await openChanges(client);
  const proposals = [];
  for (const c of changes) {
    let proposal = "";
    try {
      proposal = await readFile(join(changesDir, c.name, "proposal.md"), "utf8");
    } catch {
      /* no proposal yet */
    }
    proposals.push({
      name: c.name,
      phase: c.phase,
      readiness: c.readiness,
      dependencyReview: c.dependencyReview, // "pending" until a `## Depends On` block exists
      dependsOn: c.dependsOn,
      newCapabilities: c.newCapabilities,
      modifiedCapabilities: c.modifiedCapabilities,
      proposal, // proposal text only — never config, env, or secrets
    });
  }
  return { proposals };
}

async function setDependency(client: OpenSpecClient, changesDir: string, from: string, to: string) {
  if (!from || !to) throw new Error("both 'from' and 'to' are required");
  if (from === to) throw new Error("a change cannot depend on itself");
  const names = new Set((await openChanges(client)).map((c) => c.name));
  if (!names.has(from)) throw new Error(`unknown open change: ${from}`);
  if (!names.has(to)) throw new Error(`unknown open change: ${to}`);

  const path = join(changesDir, from, "proposal.md");
  const text = await readFile(path, "utf8");
  const updated = addDependsOn(text, to);
  const written = updated !== text;
  if (written) await writeFile(path, updated);

  return { from, to, written, dependsOn: await client.readProposalDependsOn(from) };
}

async function markIndependent(client: OpenSpecClient, changesDir: string, change: string) {
  if (!change) throw new Error("'change' is required");
  const names = new Set((await openChanges(client)).map((c) => c.name));
  if (!names.has(change)) throw new Error(`unknown open change: ${change}`);

  const path = join(changesDir, change, "proposal.md");
  const text = await readFile(path, "utf8");
  const updated = ensureDependsOnSection(text);
  const written = updated !== text; // already declared -> idempotent no-op
  if (written) await writeFile(path, updated);

  return { change, written, dependencyReview: "declared" as const };
}

/**
 * Provision the `/loom:weave` command into the user's GLOBAL Claude commands
 * dir, so the review runs as one command from any project where this server is
 * registered. Writes only the static command file; overwrites in place.
 */
async function installWeaveSkill() {
  const dir = join(homedir(), ".claude", "commands", "loom");
  const path = join(dir, "weave.md");
  await mkdir(dir, { recursive: true });
  await writeFile(path, WEAVE_COMMAND);
  return {
    installed: true,
    command: "/loom:weave",
    path,
    note: "Reload Claude Code (restart the session) to pick up the new /loom:weave command.",
  };
}

/** Add `- <dep>` under a `## Depends On` section, creating the section if absent. */
function addDependsOn(text: string, dep: string): string {
  const lines = text.split("\n");
  const headerIdx = lines.findIndex((l) => /^##\s+Depends On\b/.test(l));
  const bullet = `- ${dep}`;
  if (headerIdx === -1) {
    return `${text.replace(/\s*$/, "")}\n\n## Depends On\n${bullet}\n`;
  }
  let end = headerIdx + 1;
  while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
  const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const present = lines
    .slice(headerIdx + 1, end)
    .some((l) => new RegExp(`^-\\s+\`?${escaped}\`?\\s*$`).test(l.trim()));
  if (present) return text;
  let insert = end;
  while (insert > headerIdx + 1 && lines[insert - 1].trim() === "") insert--;
  lines.splice(insert, 0, bullet);
  return lines.join("\n");
}

/** Ensure an empty `## Depends On` section exists. Idempotent: unchanged if a heading is already present. */
function ensureDependsOnSection(text: string): string {
  if (/(?:^|\n)##\s+Depends On\b/.test(text)) return text;
  return `${text.replace(/\s*$/, "")}\n\n## Depends On\n`;
}
