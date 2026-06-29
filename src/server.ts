// Serve the SPA on loopback and push roadmap + MCP + project state over a websocket.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
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

  // One MCP server + transport per client session (stateful Streamable-HTTP),
  // keyed by the session id. Each session's tools resolve their target project
  // per call from getCurrentProject (see mcpServer.ts), so one daemon serves
  // every project.
  const mcpTransports = new Map<string, StreamableHTTPServerTransport>();

  const handleMcp = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        let transport = sessionId ? mcpTransports.get(sessionId) : undefined;
        if (!transport) {
          if (!isInitializeRequest(body)) {
            return sendError(res, 400, "missing or invalid mcp-session-id");
          }
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              mcpTransports.set(sid, transport!);
            },
          });
          transport.onclose = () => {
            if (transport!.sessionId) mcpTransports.delete(transport!.sessionId);
          };
          await createMcpServer({ getCurrentProject }).connect(transport);
        }
        await transport.handleRequest(req, res, body);
        return;
      }
      if (req.method === "GET" || req.method === "DELETE") {
        const transport = sessionId ? mcpTransports.get(sessionId) : undefined;
        if (!transport) return sendError(res, 400, "missing or invalid mcp-session-id");
        await transport.handleRequest(req, res);
        return;
      }
      return sendError(res, 405, "method not allowed");
    } catch (e) {
      if (!res.headersSent) {
        sendError(res, 500, e instanceof Error ? e.message : "mcp error");
      }
    }
  };

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
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

      // static assets (served from public/ on the filesystem)
      const rel = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
      if (rel.includes("..")) return sendError(res, 403, "forbidden");
      const file = await loadAsset(rel, publicDir);
      if (!file) return sendError(res, 404, "not found");
      res.writeHead(200, { "content-type": MIME[extname(rel)] ?? "application/octet-stream" });
      res.end(file);
    } catch {
      sendError(res, 500, "error");
    }
  });

  wss = new WebSocketServer({ server: http });
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

  await new Promise<void>((resolve) => http.listen(port, host, resolve));

  return {
    port,
    broadcast,
    close: () => {
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

/** Read and JSON-parse a request body; returns undefined for an empty body. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
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
