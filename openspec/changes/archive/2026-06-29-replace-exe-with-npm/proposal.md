## Why

The published `DataLoom.exe` is an unsigned Node SEA binary, so Windows SmartScreen flags it as an unrecognized app and AV engines false-positive on it. Code signing is the only real SmartScreen fix and carries cost/eligibility friction. But DataLoom is already a Node daemon + browser SPA, and the repo is already npm-ready: `package.json` exposes `bin` `data-loom` → `dist/index.js`, `npm run build` is `tsc`, and `src/assets.ts` already reads `public/` from the filesystem when not running as a SEA. Publishing to npm sidesteps SmartScreen entirely, for free and with no signup — `npx data-loom` runs under the user's already-signed `node.exe`, so there is no unsigned downloaded exe to flag. The deliberate, accepted tradeoff: distribution now **requires Node ≥ 20** (and the `openspec` CLI); the no-Node download-and-run audience is dropped.

## What Changes

- **Delete** `scripts/build-exe.mjs` (the entire SEA build) and the `bundle`/`package` npm scripts.
- **`package.json`**: drop `private: true`; remove exe-only devDependencies (`esbuild`, `png-to-ico`, `postject`, `rcedit`, `sharp`); add `files` (`dist`, `public`), `prepublishOnly` (`npm run build`), and `publishConfig` `{ access: public }`; add `repository`/`homepage`/`bugs`/`license`/`keywords` for a clean npm listing. Keep `bin`, `build`, `start`, `dev`, and the `ws` + `@modelcontextprotocol/sdk` runtime deps. Regenerate `package-lock.json`.
- **`src/assets.ts`**: remove the `node:sea` branch (and `SeaModule` type); `loadAsset` reads only from the filesystem. `resolvePublicDir` is unchanged — `dist/../public` resolves to the published package's `public/`.
- **`src/server.ts` / `src/mcpServer.ts`**: update the "embedded when packaged" comment; change the MCP-registration example from `DataLoom.exe mcp` to `npx data-loom mcp`.
- **`.github/workflows/release.yml`**: replace the exe build + strip-signature + checksum + GitHub-Release steps with an npm publish flow on `v*` tags — `npm ci` → `npm run build` → `npm publish --provenance --access public` (auth via an `NPM_TOKEN` secret; `id-token: write` for provenance). No GitHub Release asset is published.
- **`README.md`**: replace "download the executable" with "install from npm" (`npx data-loom` / `npm i -g data-loom`); remove the entire "Verifying your download (and the SmartScreen warning)" section; drop the "build the executable yourself" line; update the `claude mcp add` command; reword the "openspec stays external" bullet.

**BREAKING** for end users: the standalone `DataLoom.exe` download is removed; DataLoom is now obtained via npm and requires Node.

Non-goals: keeping any exe build or GitHub Release binary asset; code signing of any kind; publishing to registries other than npmjs.org.

## Capabilities

### New Capabilities

_None._ (Re-targets the existing release pipeline and adjusts launch/branding to drop the exe.)

### Modified Capabilities

- `release-pipeline`: **removes** all four exe-centric requirements (build the executable, publish it as a release asset, publish a checksum, strip the corrupted signature) and **adds** publishing the package to the npm registry on a version tag.
- `self-contained-launch`: **removes** the "Standalone executable" (no-Node/no-build) requirement; the remaining launch behaviors (openspec external, project-at-launch, resilient launch, open browser) stay but are reworded from "the executable" to "data-loom".
- `app-branding`: **removes** the "Branded executable" (`DataLoom.exe` name + file icon) requirement; favicon and header-logo branding stay.

## Impact

- **CI**: `.github/workflows/release.yml` becomes an npm-publish workflow.
- **Build/deps**: `scripts/build-exe.mjs` deleted; five exe-only devDependencies removed; `package.json` made publishable.
- **Source**: `src/assets.ts` simplified (filesystem-only); comments/examples in `src/server.ts` and `src/mcpServer.ts` updated.
- **Docs**: `README.md` install/verify/MCP sections rewritten for npm.
- **Supersedes** the just-archived `strip-corrupted-signature` and the `add-release-checksums` checksum step — both target an exe that no longer exists.
- **Maintainer action required** (analogous to the earlier signing-secret ask): add an `NPM_TOKEN` repository secret (npm automation token) and ensure the `data-loom` package name is owned/available on npmjs.org before the first tagged publish.
- **Honesty**: npm removes SmartScreen only because there is no unsigned exe — it requires Node; it does not sign anything.
