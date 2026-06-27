## 1. Explicit dependencies (data)

- [x] 1.1 Add `OpenSpecClient.readProposalDependsOn(name)` parsing `- <change-name>` bullets under a `## Depends On` heading (mirrors the capability-section parser)
- [x] 1.2 In `derive.ts`, read each change's declared dependencies and resolve them: active change → edge; archived/done → satisfied (no edge); unknown → unsatisfied dependency
- [x] 1.3 Merge explicit edges into `depMap` so phases and cycle/dangling detection account for them (de-duplicate against capability edges)

## 2. Readiness

- [x] 2.1 Add a `readiness` field (`ready` | `blocked` | `done`) to the change model type
- [x] 2.2 Classify each non-archived change: done if complete/archived; ready if all dependencies are done/archived; blocked otherwise
- [x] 2.3 Emit `readiness` in the roadmap model

## 3. Guidance (view)

- [x] 3.1 Render a ready/blocked badge on active, not-done cards (done cards unchanged)
- [x] 3.2 On blocked cards, indicate which dependency is not yet done
- [x] 3.3 Highlight the earliest-phase ready proposals with an accent ring (no separate "implement next" banner — removed per feedback)

## 4. Verification

- [x] 4.1 With two open proposals where B declares `## Depends On A`, confirm B lands in a later phase and is `blocked` while A is not done
- [x] 4.2 Mark A done (tasks complete) and confirm B becomes `ready` even before A is archived
- [x] 4.3 Confirm a `## Depends On` entry for an archived change is satisfied (no block), and an unknown name surfaces as a conflict
- [x] 4.4 Confirm the roadmap highlights the ready proposal(s) as next-up and distinguishes blocked ones
