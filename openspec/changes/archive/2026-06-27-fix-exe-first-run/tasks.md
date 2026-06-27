## 1. Resilient launch

- [x] 1.1 In `src/index.ts`, resolve the active project to: the launch project if viewable, else the first viewable discovered candidate, else `null`
- [x] 1.2 Start with no session when the active project is `null` (do not exit); keep the `openspec` prerequisite check as a fail-loud exit
- [x] 1.3 In `src/projects.ts`, include the active path only when it is viewable; report `current` as empty when there is no active project

## 2. Auto-open browser

- [x] 2.1 Add a cross-platform browser-open (start / open / xdg-open) invoked after the server is listening, gated by `DATA_LOOM_NO_OPEN`, with failures ignored

## 3. No-active-project UI

- [x] 3.1 Render an empty roadmap prompt ("select a project to begin") when no model/project is active
- [x] 3.2 Add a disabled "Select a project…" placeholder to the selector when `current` is empty; selecting a candidate calls the existing select flow

## 4. Release

- [x] 4.1 Bump the version to 0.1.1

## 5. Verification

- [x] 5.1 Launch the exe from a non-project folder with no args and confirm it serves the dashboard (no exit) with the picker
- [x] 5.2 Confirm the browser-open is invoked on launch and is suppressed by `DATA_LOOM_NO_OPEN`
- [x] 5.3 Confirm selecting a project from the no-project state loads its roadmap
- [x] 5.4 Confirm launching with a valid project argument still works as before
