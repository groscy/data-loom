## Context

`data-loom autostart enable` already chains login registration, daemon start, and Claude Code registration — it is nearly the one-command setup, but it is buried mid-README, does not check the openspec prerequisite until the daemon fails to boot, and its name says "autostart", not "set everything up". The install journey is the last multi-step part of deployment.

## Goals / Non-Goals

**Goals:**
- One paste (`npx @lyric_dev/data-loom up <path>`) from fresh machine to fully working always-on setup.
- The openspec prerequisite surfaces before any setup happens, with the exact fix.
- Safe to re-run; useful as a "check my setup" command.

**Non-Goals:**
- Installing `openspec` ourselves (it stays external — design principle; also `up` must be safe non-interactively).
- Bundling Node or shipping a binary (separate exploration; out of scope here).
- Replacing or deprecating the granular verbs.

## Decisions

### 1. A new `up` verb rather than promoting `autostart enable`

`up` is discoverable, matches ecosystem convention (`docker compose up`), and gives a place for prerequisite checks and a setup summary without overloading `autostart enable`'s narrower contract. Internally it delegates to the same `autostart.enable` → `lifecycle.start` → `claudeCode.connect` sequence.

- *Alternative — document `autostart enable` as the one-liner:* rejected; no prerequisite pre-check, misleading name for a first-run command, and no room for a summary without changing its existing output contract.
- *Alternative — name it `setup`:* viable; `up` chosen for brevity and convention. Recorded here so the choice is deliberate.

### 2. Prerequisite check is fail-fast and non-interactive

`up` runs `openspec --version` (via the existing `OpenSpecClient.checkAvailable`) first. Missing → print `npm install -g openspec` and exit non-zero having changed nothing. No interactive prompt and no auto-install: `up` may be run from scripts, and installing another package on the user's behalf crosses the "openspec stays external" principle.

### 3. Summary over silence

`up` ends with a short state report: daemon URL and running state, autostart enabled (and mechanism), Claude Code registration result, and the `/loom:weave` hint. On re-run, each line reports "already" states — making `up` double as a setup health check.

## Risks / Trade-offs

- [`npx` invocations make the autostart registration point at an ephemeral npx cache] → Mitigation: this is the existing behavior of `enable` under npx and is addressed by harden-always-on's stable launch target; `up` additionally recommends `npm install -g` in its summary when it detects an npx run.
- [Two verbs (`up`, `autostart enable`) with overlapping effect could confuse] → Mitigation: README positions `up` as "first run / fix my setup" and the granular verbs as controls; `up` output names the underlying commands it ran.

## Open Questions

- Should `up` open the dashboard in the browser at the end (foreground-style finish)? Leaning yes for first run, suppressed on re-run when already running.
