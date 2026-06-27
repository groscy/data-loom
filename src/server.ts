// Serve the SPA on loopback and push roadmap + MCP + project state over a websocket.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { loadAsset } from "./assets.js";
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
}): Promise<RunningServer> {
  const { publicDir, host, port, getRoadmap, getMcp, checkMcp, getProjects, selectProject } = opts;

  let wss: WebSocketServer;
  const broadcast = (msg: unknown): void => {
    const data = JSON.stringify(msg);
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  };

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}`);

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

      // static assets (embedded when packaged, filesystem in dev)
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
