## Context

DataLoom currently ships as an unsigned Node SEA `DataLoom.exe` built by `scripts/build-exe.mjs` and published to a GitHub Release (with a SHA-256 checksum and, after the prior change, a stripped signature). The exe trips Windows SmartScreen and AV heuristics; signing is the only real SmartScreen fix and is deferred for cost/eligibility reasons. The app itself is a Node daemon + browser SPA and is already structured for npm: `package.json` declares `bin` `data-loom` → `dist/index.js`, `npm run build` compiles with `tsc`, and `src/assets.ts` already falls back to reading `public/` from disk when `node:sea` is unavailable. This change drops the exe path entirely and distributes via npm.

## Goals / Non-Goals

**Goals:**
- Publish `data-loom` to npm on each version tag; users install/run via `npm i -g data-loom` or `npx data-loom`.
- Remove every trace of the SEA exe build (script, deps, scripts, asset branch, docs, exe-centric specs).
- Keep runtime behavior identical (openspec-external, project-at-launch, resilient launch, browser open, MCP server mode).

**Non-Goals:**
- Code signing of any kind, or any continued exe/GitHub-Release binary artifact.
- Bundling the app into a single file (npm resolves `dependencies` at install time — no esbuild needed).
- Publishing to registries other than npmjs.org.

## Decisions

### 1. Ship compiled `dist/` + `public/`, not a bundle
npm installs `dependencies` (`ws`, `@modelcontextprotocol/sdk`) for the user, so there is no need to bundle. The package ships the `tsc` output (`dist/`) and the static SPA assets (`public/`), gated by an explicit `files` allowlist so `src/`, `openspec/`, tests, and configs are not published. `bin` stays `data-loom` → `dist/index.js`; `src/index.ts` already begins with `#!/usr/bin/env node`, which `tsc` preserves, so the global shim works on POSIX (and npm generates `.cmd`/`.ps1` shims on Windows). A `prepublishOnly: npm run build` guarantees `dist/` is fresh at publish time even though `dist/` is git-ignored.

### 2. Asset resolution needs no runtime change beyond deleting the SEA branch
`resolvePublicDir()` returns `dirname(import.meta.url)/../public`. From the published layout (`dist/assets.js`), that resolves to the package root's `public/`, which is shipped. `loadAsset` currently tries `node:sea` first and falls back to the filesystem; with the exe gone the SEA branch is dead, so it is removed and `loadAsset` reads only from `publicDir`. Behavior under npm is unchanged because the SEA branch never triggered there anyway.

### 3. Release workflow becomes `npm publish` with provenance
On a `v*` tag: `actions/checkout` → `actions/setup-node` (with `registry-url: https://registry.npmjs.org`) → `npm ci` → `npm run build` → `npm publish --provenance --access public`. Auth uses an `NPM_TOKEN` secret exposed as `NODE_AUTH_TOKEN`; `--provenance` (with `permissions: id-token: write`) attaches a verifiable build-provenance attestation, which is the npm-native analogue of the checksum we are dropping. The runner can move from `windows-latest` to `ubuntu-latest` — publishing is OS-independent and Linux runners are faster/cheaper. Build failure throws before `npm publish`, so nothing is published (satisfying "build failure publishes nothing").

### 4. `data-loom` stays the package name; make it publishable
The name is already `data-loom` (lowercase, npm-legal; product is branded "DataLoom"). Removing `private: true` and adding `publishConfig: { access: public }`, `repository`, `homepage`, `bugs`, `license`, and `keywords` makes it a clean public listing. **Maintainer action**: own/claim `data-loom` on npmjs.org and add the `NPM_TOKEN` secret before the first tagged publish.

### 5. Capability `self-contained-launch` loses its "self-contained" core
The "Standalone executable / runs without Node" requirement is removed — npm fundamentally requires Node. The remaining requirements (openspec external, project arg, resilient launch, open browser) are unchanged in behavior and only reworded from "the executable" to "data-loom". The capability name is kept for continuity; its Purpose is already `TBD` and is not in scope to rewrite here.

## Risks / Trade-offs

- **Drops the no-Node audience.** The exe existed for users without Node; npm cannot serve them. → Accepted and explicit (the maintainer chose npm specifically to escape SmartScreen for free); documented in the README.
- **First publish needs npm ownership + `NPM_TOKEN`.** Without them the tagged workflow fails at `npm publish`. → Called out as a required maintainer action; the workflow fails closed (nothing partial is published).
- **`prepublishOnly` / shipped `dist`.** If `dist/` were shipped stale, users would run old code. → `prepublishOnly: npm run build` rebuilds before every publish; `files` ships `dist/` fresh from that build.
- **Provenance prerequisites.** `--provenance` needs `id-token: write` and a public repo. → Both hold here; if provenance ever blocks a publish it can be dropped without affecting the package itself.
- **Supersedes recent work.** The `strip-corrupted-signature` and `add-release-checksums` requirements are removed. → Intentional: they targeted an exe that no longer exists.

## Open Questions

- Whether to ALSO cut a GitHub Release (notes only, no binary) per tag for changelog visibility. Default: no — npm is the single release channel. Can be added later without affecting the package.
