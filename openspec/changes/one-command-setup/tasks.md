## 1. Verb implementation

- [x] 1.1 Add `up` to the CLI verb dispatch in `src/index.ts`, accepting an optional project path and the `--no-start` / `--no-connect` flags
- [x] 1.2 Implement the fail-fast openspec pre-check via `OpenSpecClient.checkAvailable`: on missing, print `npm install -g openspec` guidance and exit non-zero before any setup step
- [x] 1.3 Delegate to the existing enable sequence (`autostart.enable` → `lifecycle.start` → `claudeCode.connect`), capturing each step's outcome instead of only logging

## 2. Summary and idempotence

- [x] 2.1 Print the end-of-run summary: dashboard URL + daemon state, autostart state, Claude Code registration outcome, `/loom:weave` pointer
- [x] 2.2 Make re-runs report "already in place" per step (already running, already registered, already enabled) with no duplicate registrations
- [x] 2.3 Detect an npx (non-global) invocation and add a `npm install -g @lyric_dev/data-loom` recommendation line to the summary

## 3. Verification and docs

- [x] 3.1 Verified on the already-configured host: `data-loom up` composes the prereq check + autostart refresh + daemon reuse + Claude Code registration and prints the summary (dashboard running, autostart startup-shortcut, claude code registered, weave pointer). (Note: this host's Task Scheduler denies non-elevated task creation, so autostart is the unsupervised shortcut — the supervised path is covered by harden-always-on.)
- [x] 3.2 Verified missing-openspec flow: running `up` with `openspec` off PATH prints the error + `npm install -g openspec` guidance, exits code 1, and performs no setup step (no "autostart enabled" output) — system left untouched
- [x] 3.3 Verified double-run: two consecutive `up` runs report "already enabled — refreshed", "already running", and idempotent Claude Code registration with no duplicates
- [x] 3.4 Restructured README to lead with the `data-loom up` one-liner ("Get started (one command)") and reframed the always-on section as "manual controls" that `up` composes
