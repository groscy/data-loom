// Serve the SPA on loopback and push the roadmap model over a websocket.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, sep } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { RoadmapModel } from "./types.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export interface RunningServer {
  port: number;
  broadcast: (model: RoadmapModel) => void;
  close: () => void;
}

export async function startServer(opts: {
  publicDir: string;
  host: string;
  port: number;
  getModel: () => RoadmapModel | null;
}): Promise<RunningServer> {
  const { publicDir, host, port, getModel } = opts;
  const root = normalize(publicDir);

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname === "/api/model") {
        res.writeHead(200, { "content-type": MIME[".json"] });
        res.end(JSON.stringify(getModel()));
        return;
      }
      const rel = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = normalize(join(root, rel));
      if (filePath !== root && !filePath.startsWith(root + sep)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });

  const wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws) => {
    const model = getModel();
    if (model) ws.send(JSON.stringify({ type: "model", model }));
  });

  await new Promise<void>((resolve) => http.listen(port, host, resolve));

  return {
    port,
    broadcast: (model) => {
      const msg = JSON.stringify({ type: "model", model });
      for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }
    },
    close: () => {
      wss.close();
      http.close();
    },
  };
}
