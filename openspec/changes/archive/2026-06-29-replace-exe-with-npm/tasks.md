## 1. Package manifest & dependencies

- [x] 1.1 In `package.json`: remove `private: true`; remove the `bundle` and `package` scripts; remove the exe-only devDependencies (`esbuild`, `png-to-ico`, `postject`, `rcedit`, `sharp`)
- [x] 1.2 In `package.json`: add `files` (`["dist", "public"]`), `prepublishOnly` (`npm run build`), and `publishConfig` (`{ "access": "public" }`); add `repository`, `homepage`, `bugs`, `license` (MIT), and `keywords` for the npm listing; keep `bin`, `build`, `start`, `dev`, and the `ws` + `@modelcontextprotocol/sdk` runtime deps
- [x] 1.3 Run `npm install` to regenerate `package-lock.json` without the removed devDependencies — removed 23 packages, 0 vulnerabilities

## 2. Remove the SEA build & source references

- [x] 2.1 Delete `scripts/build-exe.mjs` (the only file under `scripts/`)
- [x] 2.2 In `src/assets.ts`: remove the `node:sea` branch and `SeaModule` type so `loadAsset` reads only from the filesystem; update the comments (`resolvePublicDir` left as-is)
- [x] 2.3 In `src/server.ts`: update the asset comment to "served from public/ on the filesystem"
- [x] 2.4 In `src/mcpServer.ts`: change the MCP-registration example to `claude mcp add data-loom -- npx data-loom mcp "<project>"`

## 3. Release workflow

- [x] 3.1 Rewrite `.github/workflows/release.yml`: on `v*` tags, `checkout` → `setup-node` (`registry-url: https://registry.npmjs.org`) → `npm ci` → `npm run build` → `npm publish --provenance --access public`, authenticated via `NODE_AUTH_TOKEN` from `secrets.NPM_TOKEN`, with `permissions: { contents: read, id-token: write }` on `ubuntu-latest`. Exe build/strip/checksum/GitHub-Release steps removed

## 4. Docs

- [x] 4.1 In `README.md`: replaced the "download the executable" section with an "install from npm" section (`npx data-loom` / `npm install -g data-loom`, Node ≥ 20 note); updated the prerequisite note
- [x] 4.2 In `README.md`: removed the entire "Verifying your download (and the SmartScreen warning)" section (download/checksum/SmartScreen/Defender)
- [x] 4.3 In `README.md`: dropped the "build the executable yourself" line (kept the data-loom/DataLoom branding note); updated the `claude mcp add` command to `npx data-loom`; reworded the "openspec stays external" bullet

## 5. Verification

- [x] 5.1 `npm run build` succeeds; `dist/index.js` exists and starts with `#!/usr/bin/env node`
- [x] 5.2 `npm pack --dry-run` lists only `dist/`, `public/`, `package.json`, `README.md`, `LICENSE` (19 files, 25 kB) and excludes `src/`, `openspec/`, tsconfig — the `files` allowlist overrides the `dist/` gitignore
- [x] 5.3 Ran `node dist/index.js "<repo>"` with `DATA_LOOM_NO_OPEN=1`: reached `[data-loom] dashboard ready`; `GET /` (index.html) and `GET /style.css` both return 200, served from `public/` on the filesystem
- [x] 5.4 `release.yml` parses as YAML and contains the npm-publish flow (no exe/strip/checksum steps); `openspec validate replace-exe-with-npm` passes
- [x] 5.5 Grep of the live tree (`src/`, `README.md`, `package.json`, `package-lock.json`, `.github/`, `public/`) for residual exe references (`DataLoom.exe`, `build-exe`, `postject`, `node:sea`, `sharp`, `SmartScreen`, `sha256`, …) returns no matches
