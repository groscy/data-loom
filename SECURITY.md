# Security Policy

## Supported versions

DataLoom is distributed via npm as `@lyric_dev/data-loom`. Fixes are released
against the latest published version; please upgrade to the latest release before
reporting an issue.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through either of:

- GitHub's [private vulnerability reporting](https://github.com/groscy/data-loom/security/advisories/new)
  (Security → Report a vulnerability), or
- email **cyril.grossenbacher@gmx.ch** with a description and, ideally, a minimal
  reproduction.

Please include the DataLoom version (`data-loom --version` or the package
version), your OS, and the steps to reproduce. You'll get an acknowledgement, and
we'll keep you updated on the fix and disclosure timeline. Please give a
reasonable window to release a fix before any public disclosure.

## Scope and threat model

DataLoom is a **fully-local, single-user** tool by design. The daemon (dashboard,
WebSocket, and MCP endpoint) binds to the loopback interface (`127.0.0.1`) only
and is never exposed to the network:

- **Loopback only** — nothing listens off-host.
- **Host + Origin validated** — HTTP requests and WebSocket upgrades with a
  non-loopback `Host` (DNS-rebinding) or non-loopback `Origin` (cross-site) are
  rejected, so a website you visit can't drive the daemon.
- **No secrets** — the MCP tools carry only proposal text and change names; the
  topology view shows scheme+host only and redacts server commands/args. The
  daemon holds no credentials.
- **Bounded** — request bodies are capped (4 MB) and MCP sessions are capped and
  idle-evicted.

The MCP tools can read and write any OpenSpec workspace path you point them at —
this is intentional, so the tooling stays LLM-provider-independent. Treat the
daemon as you would any local dev server: fine on your own machine, **not**
something to run on a shared or multi-user host. Reports that reduce to "an
attacker with local access to the machine can affect it" are generally out of
scope for that reason; reports of the daemon being reachable or driveable from
**off-host or from a web page** are firmly in scope.
