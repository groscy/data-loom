## Context

The app already has a dark UI with an accent palette (blue `--accent`, green `--done`). Branding should reuse that palette so the icon feels native. The two surfaces with real constraints are the **browser** (favicon + header, where an SVG is ideal) and the **Windows executable** (which needs an embedded `.ico`, requiring a rasterization step in packaging). The SEA packaging from the previous change is the hook for setting the exe icon.

## Goals / Non-Goals

**Goals:**
- One canonical vector icon (`public/icon.svg`) reused everywhere.
- "DataLoom" as the display name in the header, page title, and README.
- The Windows executable named `DataLoom.exe` and carrying the app icon.

**Non-Goals:**
- Renaming the npm package (`data-loom` stays — npm requires lowercase).
- Multi-platform icon formats (macOS `.icns`) — Windows `.ico` only for now.
- A full brand system (just the icon + name).

## Decisions

### D1 — One SVG, hand-authored
The icon is a single hand-authored `public/icon.svg` on a rounded-square tile: an over/under **weave** of two threads (accent blue + green) with small **node dots** at the intersections — "weaving data," matching the loom metaphor. It must read at 16px (favicon), so few elements, strong contrast, no fine detail. This SVG is the single source for every surface.

### D2 — Browser surfaces
`index.html` gets `<link rel="icon" type="image/svg+xml" href="/icon.svg">` and a header logo (`<img src="/icon.svg">` or inline SVG) beside the name. The header currently renders `data<span>_</span>loom`; it becomes the icon + "DataLoom". A small PNG fallback favicon is optional (modern browsers accept SVG favicons).

### D3 — Display name vs package id
User-facing strings become "DataLoom" (header, `<title>`, README headings/prose). `package.json` `name` stays `data-loom`; `bin` stays `data-loom` for the dev `npm start` path. Only the *product* name and the *exe artifact* change.

### D4 — Executable icon + name
During packaging:
1. Rasterize `public/icon.svg` to PNGs (e.g. 16/32/48/64/128/256) and combine into `build/icon.ico`. Toolchain: a SVG rasterizer (`sharp` or `@resvg/resvg-js`) + `png-to-ico`.
2. Copy the Node binary to `build/DataLoom.exe`.
3. Set the icon with `rcedit` **before** `postject` injection (rcedit rewrites resources; doing it first avoids disturbing the injected blob).
4. Inject the SEA blob as before.
The release workflow and README reference `DataLoom.exe`.

### D5 — Keep packaging resilient
The icon/ico generation and `rcedit` are wrapped so a failure is a clear error in the `package` script, not a half-built exe. The from-source run path is unaffected (no icon needed there).

## Risks / Trade-offs

- **Native image deps** (`sharp`/`resvg`) add weight and must install on the CI Windows runner → both ship prebuilt Windows binaries; acceptable. If install proves troublesome, pre-generate and commit `build/icon.ico` from the SVG as a fallback.
- **rcedit + postject ordering** → set the icon on the copied node binary first, then inject; verify the exe still launches and shows the icon.
- **SVG favicon support** → fine in current browsers; add a PNG fallback only if needed.
- **Icon legibility at 16px** → keep the weave to a 2×2 or 3×3 grid with bold strokes; test at small size.

## Open Questions

- **Inline SVG vs `<img>` for the header logo** — `<img>` is simpler and cache-friendly; inline allows CSS theming. Default to `<img>`; revisit only if we want the logo to recolor with the theme.
- **macOS/Linux icons** — deferred until those builds exist.
