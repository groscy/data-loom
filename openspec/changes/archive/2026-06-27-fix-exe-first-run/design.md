## Context

`src/index.ts` currently resolves one project (arg → env → cwd) and **exits** if it has no `openspec/` workspace, then starts the server and never opens a browser. The daemon already supports most of a "no active project" path: `getRoadmap` returns `null` when there's no session (and the server guards on it), `getMcp` returns an empty list, and `discoverProjects` finds candidates from `~/.claude.json`. So the fix is mostly relaxing the launch guard, adding a browser-open, and making the picker usable with no active project.

## Goals / Non-Goals

**Goals:**
- A double-clicked exe opens the dashboard in the browser and lets the user pick a project.
- Never exit just because the launch directory isn't an openspec project.
- Keep the openspec-prerequisite fail-loud behavior.

**Non-Goals:**
- Auto-launching a project when several are discovered (pick the first; the user can switch).
- A native window/tray — still a localhost dashboard.

## Decisions

### D1 — Launch resolution
```
initial = resolve(arg ?? DATA_LOOM_ROOT ?? cwd)
active  = isViewableProject(initial) ? initial
        : firstViewable(discoverProjects(initial).candidates) ?? null
```
If `active` is set, build a session; if `null`, start with no session (no-project state). The daemon always starts serving — it only exits for the missing-openspec-CLI prerequisite.

### D2 — discoverProjects must not offer a non-project
`discoverProjects` currently force-includes the active path even if it has no `openspec/`. Change it to include the active path only when it is viewable, and report `current` as `""` when there is no active project. The picker then shows real candidates with none selected (a leading "Select a project…" placeholder when current is empty).

### D3 — Open the browser on startup
After the server is listening, open the dashboard URL with the platform opener (`start ""` on Windows, `open` on macOS, `xdg-open` on Linux), unless `DATA_LOOM_NO_OPEN` is set (used by dev/headless/tests). Failure to open is non-fatal — the URL is already logged.

### D4 — No-active-project UI
With no session, `getRoadmap` returns `null` → the view shows an empty roadmap with a "select a project to begin" prompt; the selector is populated from `getProjects`. Selecting a candidate calls the existing `selectProject`, which builds the session and broadcasts. The existing empty-state text is reused/extended.

## Risks / Trade-offs

- **Auto-open spawns a browser** → gated by `DATA_LOOM_NO_OPEN`; wrapped so any failure is ignored (the dashboard still runs and the URL is printed).
- **No discovered projects at all** (no Claude Code config) → the dashboard still opens on an empty state where the user types a path; it does not crash or exit.
- **Picker with empty `current`** → add a disabled placeholder option so the `<select>` shows "Select a project…" rather than a misleading first entry.

## Migration Plan

Additive behavior change; no data migration. Terminal usage with a project arg is unchanged. Ship as `v0.1.1` (CI rebuilds the exe on the tag).

## Open Questions

- **Remember the last project** across runs (small state file) so a re-launched exe reopens the previous project — still deferred; the discovered-first default is enough for now.
