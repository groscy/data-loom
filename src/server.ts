// Serve the SPA on loopback and push roadmap + MCP state over a websocket.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, sep } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { RoadmapModel } from "./types.js";
import type { McpModel, McpServer } from "./mcp/types.js";

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
}): Promise<RunningServer> {
  const { publicDir, host, port, getRoadmap, getMcp, checkMcp } = opts;
  const root = normalize(publicDir);

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
      if (url.pathname === "/api/mcp/check" && req.method === "POST") {
        const name = url.searchParams.get("name") ?? "";
        const server = await checkMcp(name);
        if (!server) {
          res.writeHead(404, { "content-type": MIME[".json"] });
          res.end(JSON.stringify({ error: `unknown server: ${name}` }));
          return;
        }
        broadcast({ type: "mcpServer", server });
        return sendJson(res, server);
      }

      const rel = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = normalize(join(root, rel));
      if (filePath !== root && !filePath.startsWith(root + sep)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const file = await readFile(filePath);
      res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
      res.end(file);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });

  wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws) => {
    const roadmap = getRoadmap();
    if (roadmap) ws.send(JSON.stringify({ type: "model", model: roadmap }));
    ws.send(JSON.stringify({ type: "mcp", mcp: getMcp() }));
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
