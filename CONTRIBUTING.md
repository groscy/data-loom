# Contributing to DataLoom

Thanks for your interest in improving DataLoom. This project is developed
spec-first with [OpenSpec](https://github.com/Fission-AI/OpenSpec): every
non-trivial change starts as a proposal under `openspec/`, is built against that
proposal, and the specs are synced when it's archived. The workflow below keeps
contributions aligned with that model.

## Ground rules

- Be respectful and constructive. Assume good faith.
- Keep changes focused — one logical change per pull request.
- Discuss anything large in an issue first, so we agree on the approach before
  you invest the time.

## Development setup

Requires [Node.js](https://nodejs.org) ≥ 20 and npm.

```bash
git clone https://github.com/groscy/data-loom.git
cd data-loom
npm install
npm run build          # tsc — this is also the typecheck gate CI runs
npm start              # serve the current directory's project
# or: npm start -- "C:\path\to\a\project"
```

`npm run dev` rebuilds and restarts on change (`tsc && node --watch`). The
package is `@lyric_dev/data-loom` and installs a `data-loom` command; the
product is branded **DataLoom**. To exercise the dashboard you need an
`openspec/` workspace to point it at — this repo's own `openspec/` works.

The [ARCHITECTURE.md](ARCHITECTURE.md) file maps the daemon's subsystems, the
live write-back loop, and the modules under `src/` — read it before changing how
the pieces fit together.

## Making a change

For anything beyond a typo or a trivial fix, use the OpenSpec flow:

1. **Propose.** Create a change proposal under `openspec/changes/` describing the
   WHAT and WHY, the affected capabilities, and a task list. If you use Claude
   Code, `/openspec:propose` scaffolds this for you.
2. **Build.** Implement against the proposal, working through its tasks.
3. **Sync & archive.** When the work lands, sync the capability specs and archive
   the change (`/openspec:archive`).

Independent proposals should declare their dependency order via a `## Depends On`
block — this is what the roadmap derives phases from. See the README's
"Plan dependencies with your Claude" section.

## Before you open a pull request

- **Build passes:** `npm run build` completes with no TypeScript errors. The code
  is `strict`, so the build is a real typecheck — treat any error as a blocker.
- **Scope is tight:** no unrelated reformatting, no stray files (`dist/` and
  `build/` are git-ignored — don't commit build output).
- **Docs updated:** if behavior, commands, or architecture changed, update the
  README / ARCHITECTURE.md accordingly.

## Commit and PR conventions

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: show the proposal task list in the change detail panel
fix: skip redundant daemon start when the supervisor already launched it
docs: add ARCHITECTURE.md with module map and diagram
chore: archive show-proposal-tasks and sync its specs
```

Common types here: `feat`, `fix`, `docs`, `chore`, `refactor`. Keep the subject
in the imperative mood and under ~72 characters.

Open the PR against `master`. Fill in the template — say what changed and why,
link any related issue or OpenSpec change, and note how you verified it.

## Releases

Releases are automated: pushing a `vX.Y.Z` tag triggers the `release` workflow,
which builds and publishes `@lyric_dev/data-loom` to npm with provenance. You
don't need to touch this — maintainers cut releases from `master`.

## Reporting bugs and requesting features

Use the issue templates (Bug report / Feature request). For anything
security-sensitive, follow [SECURITY.md](SECURITY.md) instead of opening a public
issue.
