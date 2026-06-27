// MCP topology model. Only sanitized data here ever reaches the browser —
// ProbeTarget (with real command/url) stays inside the daemon.

export type McpTransport = "stdio" | "http" | "sse" | "unknown";
export type McpScope = "global" | "project";
export type McpLiveness =
  | "unknown" // never checked
  | "checking"
  | "available" // URL endpoint answered
  | "needs-auth" // URL endpoint answered 401/403
  | "unreachable" // URL endpoint refused / timed out
  | "on-demand" // stdio: nothing running, launches when the IDE calls it
  | "already-running"; // stdio: a matching process is in the OS table

/** Public, secret-free server entry sent to clients. */
export interface McpServer {
  name: string;
  transport: McpTransport;
  scope: McpScope;
  source: string; // human label of where it was found
  command?: string; // stdio: binary name only
  url?: string; // url servers: scheme://host only
  detail?: string; // redacted args summary or url host
  liveness: McpLiveness;
  lastChecked?: string;
}

export interface McpModel {
  hub: string; // always "Claude Code"
  servers: McpServer[];
}

/** Internal probe target — holds real command/url, never serialized to clients. */
export interface ProbeTarget {
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
}

export interface Discovery {
  servers: McpServer[];
  probes: Map<string, ProbeTarget>;
}
