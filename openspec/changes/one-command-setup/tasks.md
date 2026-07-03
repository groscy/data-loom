## 1. Verb implementation

- [ ] 1.1 Add `up` to the CLI verb dispatch in `src/index.ts`, accepting an optional project path and the `--no-start` / `--no-connect` flags
- [ ] 1.2 Implement the fail-fast openspec pre-check via `OpenSpecClient.checkAvailable`: on missing, print `npm install -g openspec` guidance and exit non-zero before any setup step
- [ ] 1.3 Delegate to the existing enable sequence (`autostart.enable` → `lifecycle.start` → `claudeCode.connect`), capturing each step's outcome instead of only logging

## 2. Summary and idempotence

- [ ] 2.1 Print the end-of-run summary: dashboard URL + daemon state, autostart state, Claude Code registration outcome, `/loom:weave` pointer
- [ ] 2.2 Make re-runs report "already in place" per step (already running, already registered, already enabled) with no duplicate registrations
- [ ] 2.3 Detect an npx (non-global) invocation and add a `npm install -g @lyric_dev/data-loom` recommendation line to the summary

## 3. Verification and docs

- [ ] 3.1 Verify fresh-host flow on Windows: `npx @lyric_dev/data-loom up <path>` → daemon running, autostart registered, Claude Code entry present, summary correct
- [ ] 3.2 Verify missing-openspec flow leaves the system untouched and exits non-zero
- [ ] 3.3 Verify double-run produces "already" reports and no duplicates
- [ ] 3.4 Restructure README to lead with the `up` one-liner and position granular verbs as controls
