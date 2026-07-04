## Why

Reaching a fully working always-on DataLoom today takes a README read and several commands across two tools (`npm install -g openspec`, install/`npx` DataLoom, then `data-loom autostart enable`), and the openspec prerequisite is only discovered when the daemon refuses to start. A single documented entry point should take a fresh machine to "daemon running, autostart on, Claude Code connected" in one paste, with the prerequisite checked up front.

## What Changes

- New **`data-loom up [project-path]`** verb: the one-command setup. It verifies the `openspec` CLI first (exiting with the exact install command when missing, before any partial setup), then runs the existing enable path — login registration, daemon start, Claude Code registration — and finishes with a summary: dashboard URL, autostart state, connection state, and a `/loom:weave` pointer.
- `up` is **idempotent and re-runnable**: on a machine that is already set up it reports the current state and changes nothing that is already in place.
- `up` passes through the existing opt-outs (`--no-start`, `--no-connect`) unchanged.
- README leads with the one-liner: `npx @lyric_dev/data-loom up "C:\path\to\project"`.

## Capabilities

### New Capabilities

- `guided-setup`: a single CLI verb that takes a fresh host from "package available" to "always-on daemon, registered with Claude Code", with the openspec prerequisite checked up front and a clear summary of what was done.

### Modified Capabilities

<!-- None. `up` composes startup-autolaunch, daemon-lifecycle, and claude-code-integration without changing their requirements; self-contained-launch's openspec-prerequisite rule is reused, not altered. -->

## Impact

- **Code**: `src/index.ts` (new verb in CLI dispatch, prerequisite pre-check reusing `OpenSpecClient.checkAvailable`), summary output composing `autostart`/`lifecycle`/`claudeCode` results.
- **Docs**: README restructured so `up` is the recommended path; existing granular commands remain documented for control.
- **No new dependencies**; no daemon/runtime changes.

## Depends On
- harden-always-on
