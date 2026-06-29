// Serve the SPA on loopback and push roadmap + MCP + project state over a websocket.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { extname, resolve, sep } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { loadAsset } from "./assets.js";
import { createMcpServer } from "./mcpServer.js";
import type { RoadmapModel } from "./types.js";
import type { McpModel, McpServer } from "./mcp/types.js";
import type { ProjectModel } from "./projects.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export interface RunningServer {
  port: number;
  broadcast: (msg: unknown) => void;
  close: () => void;
}

export async function startServer(opts: {
  publicDir: string;
  host: string;
  port: number;
  getRoadmap: () => RoadmapModel | null;
  getMcp: () => McpModel;
  checkMcp: (name: string) => Promise<McpServer | null>;
  getProjects: () => Promise<ProjectModel>;
  selectProject: (path: string) => Promise<ProjectModel>;
  getCurrentProject: () => string | null;
}): Promise<RunningServer> {
  const { publicDir, host, port, getRoadmap, getMcp, checkMcp, getProjects, selectProject, getCurrentProject } = opts;

  let wss: WebSocketServer;
  const broadcast = (msg: unknown): void => {
    const data = JSON.stringify(msg);
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  };

  // Loopback origin/host allowlist — the DNS-rebinding + CSRF guard. Built from
  // the actually-bound port after listen; seeded from the requested port so the
  // guard is active from the first request.
  const loopbackHosts = ["127.0.0.1", "localhost", "[::1]"];
  let allowedAuthorities = new Set<string>();
  const setAllowed = (p: number): void => {
    allowedAuthorities = new Set(loopbackHosts.map((h) => `${h}:${p}`));
  };
  setAllowed(port);

  // Reject what a hostile web page or a rebound DNS name could mount: a Host
  // that is not our loopback authority (DNS rebinding), or any *present* Origin
  // that is not a loopback origin (CSRF). An absent Origin = a native, non-
  // browser client (e.g. Claude Code), which is allowed.
  const isAllowed = (req: IncomingMessage): boolean => {
    const host = req.headers.host;
    if (!host || !allowedAuthorities.has(host)) return false;
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (!allowedAuthorities.has(new URL(origin).host)) return false;
      } catch {
        return false;
      }
    }
    return true;
  };

  // One MCP server + transport per client session (stateful Streamable-HTTP),
  // keyed by session id. Sessions are capped and idle-evicted so churn cannot
  // grow memory without bound. Tools resolve their target project per call from
  // getCurrentProject (see mcpServer.ts), so one daemon serves every project.
  const MAX_SESSIONS = 32;
  const SESSION_IDLE_TTL_MS = 30 * 60 * 1000;
  interface McpSession {
    transport: StreamableHTTPServerTransport;
    lastSeen: number;
  }
  const mcpSessions = new Map<string, McpSession>();

  const idleSweep = setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of mcpSessions) {
      if (now - s.lastSeen > SESSION_IDLE_TTL_MS) {
        mcpSessions.delete(sid);
        void s.transport.close();
      }
    }
  }, 60 * 1000);
  idleSweep.unref();

  const handleMcp = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const existing = sessionId ? mcpSessions.get(sessionId) : undefined;
        if (existing) {
          existing.lastSeen = Date.now();
          await existing.transport.handleRequest(req, res, body);
          return;
        }
        if (!isInitializeRequest(body)) {
          return sendError(res, 400, "missing or invalid mcp-session-id");
        }
        if (mcpSessions.size >= MAX_SESSIONS) {
          return sendError(res, 503, "too many sessions");
        }
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            mcpSessions.set(sid, { transport, lastSeen: Date.now() });
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) mcpSessions.delete(transport.sessionId);
        };
        await createMcpServer({ getCurrentProject }).connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }
      if (req.method === "GET" || req.method === "DELETE") {
        const s = sessionId ? mcpSessions.get(sessionId) : undefined;
        if (!s) return sendError(res, 400, "missing or invalid mcp-session-id");
        s.lastSeen = Date.now();
        await s.transport.handleRequest(req, res);
        return;
      }
      return sendError(res, 405, "method not allowed");
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        if (!res.headersSent) sendError(res, 413, "request body too large");
        return;
      }
      // Unexpected failures stay in the server log; the client gets nothing
      // about the host (no paths, no stack).
      console.error("[data-loom] mcp request error:", e);
      if (!res.headersSent) sendError(res, 500, "internal error");
    }
  };

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!isAllowed(req)) return sendError(res, 403, "forbidden");

      const url = new URL(req.url ?? "/", `http://${host}`);

      if (url.pathname === "/mcp") return handleMcp(req, res);

      if (url.pathname === "/api/model") return sendJson(res, getRoadmap());
      if (url.pathname === "/api/mcp") return sendJson(res, getMcp());
      if (url.pathname === "/api/projects") return sendJson(res, await getProjects());

      if (url.pathname === "/api/mcp/check" && req.method === "POST") {
        const server = await checkMcp(url.searchParams.get("name") ?? "");
        if (!server) return sendError(res, 404, "unknown server");
        broadcast({ type: "mcpServer", server });
        return sendJson(res, server);
      }

      if (url.pathname === "/api/project/select" && req.method === "POST") {
        const path = url.searchParams.get("path") ?? "";
        try {
          return sendJson(res, await selectProject(path));
        } catch (err) {
          return sendError(res, 400, err instanceof Error ? err.message : "invalid project");
        }
      }

      // static assets (served from public/ on the filesystem) — resolve and
      // assert the path stays within publicDir before reading.
      const rel = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
      const root = resolve(publicDir);
      const full = resolve(root, rel);
      if (full !== root && !full.startsWith(root + sep)) return sendError(res, 403, "forbidden");
      const file = await loadAsset(rel, publicDir);
      if (!file) return sendError(res, 404, "not found");
      res.writeHead(200, { "content-type": MIME[extname(rel)] ?? "application/octet-stream" });
      res.end(file);
    } catch {
      sendError(res, 500, "error");
    }
  });

  wss = new WebSocketServer({
    server: http,
    verifyClient: (info: { req: IncomingMessage }) => isAllowed(info.req),
  });
  wss.on("connection", async (ws) => {
    const roadmap = getRoadmap();
    if (roadmap) ws.send(JSON.stringify({ type: "model", model: roadmap }));
    ws.send(JSON.stringify({ type: "mcp", mcp: getMcp() }));
    try {
      ws.send(JSON.stringify({ type: "project", project: await getProjects() }));
    } catch {
      /* project list optional */
    }
  });

  await new Promise<void>((ready) => http.listen(port, host, ready));
  const actualPort = (http.address() as AddressInfo | null)?.port ?? port;
  setAllowed(actualPort);

  return {
    port: actualPort,
    broadcast,
    close: () => {
      clearInterval(idleSweep);
      wss.close();
      http.close();
    },
  };
}

function sendJson(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { "content-type": MIME[".json"] });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, code: number, message: string): void {
  res.writeHead(code, { "content-type": MIME[".json"] });
  res.end(JSON.stringify({ error: message }));
}

/** Raised when a request body exceeds the cap; mapped to HTTP 413. */
class PayloadTooLargeError extends Error {}

/** Largest request body we will buffer (JSON-RPC tool calls are tiny). */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/** Read and JSON-parse a request body; returns undefined for an empty body. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    let aborted = false;
    req.on("data", (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        reject(new PayloadTooLargeError("request body too large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (aborted) return;
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
