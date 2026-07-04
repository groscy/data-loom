// MCP stdio shim: spawned by a client (typically Claude Code's stdio
// registration), it ensures the daemon is running, then proxies MCP traffic
// between its own stdio and the daemon's loopback HTTP `/mcp` endpoint for the
// life of the client session.
//
// Pure proxy — no tools, prompts, or sessions of its own. The daemon remains
// the single MCP server and source of truth (including per-call project
// resolution); this file only launches (if needed) and forwards raw JSON-RPC
// messages both ways.

import { readFile } from "node:fs/promises";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { isInitializeRequest, ErrorCode, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import * as lifecycle from "./lifecycle.js";
import { mcpUrl, logFile } from "./paths.js";

const LAUNCH_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 300;

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type Readiness = { ok: true } | { ok: false; diagnosis: string };

/**
 * Ensure the daemon answers on the loopback port, starting it (through the
 * normal detached lifecycle path) if it does not. Bounded wait — never hangs.
 * A concurrent second shim racing to start is harmless: the daemon's own
 * single-instance guard (the port probe in lifecycle.start) means at most one
 * daemon results, and both shims' polls succeed against it.
 */
async function ensureDaemonUp(): Promise<Readiness> {
  if (await lifecycle.isRunning()) return { ok: true };

  await lifecycle.start();

  const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await lifecycle.isRunning()) return { ok: true };
    await delay(POLL_INTERVAL_MS);
  }
  return { ok: false, diagnosis: await diagnoseFailure() };
}

/** Best-effort explanation of why the daemon never came up, from its own log tail. */
async function diagnoseFailure(): Promise<string> {
  let tail = "";
  try {
    tail = (await readFile(logFile(), "utf8")).slice(-4000);
  } catch {
    /* no log yet — daemon likely never got far enough to write one */
  }
  if (/openspec.*was not found/i.test(tail)) {
    return (
      "DataLoom could not start: the `openspec` CLI is missing. Install it (e.g. `npm i -g openspec`), then retry. " +
      `Log: ${logFile()}`
    );
  }
  return (
    "DataLoom's daemon did not come up in time. Run `data-loom status` to check what's wrong, and see the log at " +
    logFile()
  );
}

function extractId(msg: JSONRPCMessage): string | number | undefined {
  return "id" in msg ? (msg as { id?: string | number }).id : undefined;
}

function errorResponse(id: string | number, message: string): JSONRPCMessage {
  return {
    jsonrpc: "2.0",
    id,
    error: { code: ErrorCode.InternalError, message },
  } as JSONRPCMessage;
}

/**
 * stdout is the MCP transport's wire — reserved exclusively for framed
 * JSON-RPC messages. Reused helpers here (lifecycle.start/isRunning) predate
 * the shim and log human-readable status with console.log, which writes to
 * that same stdout; left alone, those lines interleave with JSON-RPC frames
 * and corrupt the client's stream. Redirect the stdout-writing console
 * methods to stderr for this process's whole lifetime (console.warn/error
 * already go to stderr).
 */
function keepStdoutForTransportOnly(): void {
  console.log = console.error;
  console.info = console.error;
  console.debug = console.error;
}

/**
 * Entry point for `data-loom mcp-shim`. Never resolves until the client
 * session ends (or the launch fails and the handshake has been answered) —
 * the caller (index.ts) just awaits and lets the process exit naturally.
 */
export async function runShim(): Promise<void> {
  keepStdoutForTransportOnly();

  const stdio = new StdioServerTransport();

  // Buffer whatever arrives while the daemon is (maybe) still starting, so
  // nothing sent before the proxy is wired up is lost.
  const pending: JSONRPCMessage[] = [];
  stdio.onmessage = (msg) => {
    pending.push(msg);
  };
  stdio.onerror = (err) => console.error("[data-loom mcp-shim] stdio error:", err);

  await stdio.start();

  const readiness = await ensureDaemonUp();

  if (!readiness.ok) {
    const initMsg = pending.find((m) => isInitializeRequest(m));
    const id = initMsg ? extractId(initMsg) : undefined;
    if (id !== undefined) {
      await stdio.send(errorResponse(id, readiness.diagnosis));
    } else {
      // No handshake to answer yet — still surface the failure, just not as
      // an MCP response. Never exit without saying why.
      console.error(`[data-loom mcp-shim] ${readiness.diagnosis}`);
    }
    await stdio.close();
    process.exitCode = 1;
    return;
  }

  const client = new StreamableHTTPClientTransport(new URL(mcpUrl()));

  let closing = false;
  // The shim's whole job ends with its client session — one side closing
  // (client disconnects, or the daemon connection drops) tears down the
  // other, but the daemon itself is never touched.
  const closeBoth = (): void => {
    if (closing) return;
    closing = true;
    void stdio.close();
    void client.close();
    process.exit(0);
  };

  client.onmessage = (msg) => {
    void stdio.send(msg);
  };
  client.onerror = (err) => console.error("[data-loom mcp-shim] daemon connection error:", err);
  client.onclose = closeBoth;

  stdio.onerror = (err) => console.error("[data-loom mcp-shim] stdio error:", err);
  stdio.onclose = closeBoth;
  // StdioServerTransport only ever calls onclose when *we* call close() — it
  // does not itself listen for stdin ending. The client process closing its
  // end of the pipe (the real "session ended" signal) only shows up as
  // stdin's own 'end'/'close' event, so that is what actually has to trigger
  // teardown here.
  process.stdin.on("end", closeBoth);
  process.stdin.on("close", closeBoth);

  await client.start();
  for (const msg of pending) await client.send(msg);
  // From here on, every message from the client goes straight through.
  stdio.onmessage = (msg) => {
    void client.send(msg);
  };
}
