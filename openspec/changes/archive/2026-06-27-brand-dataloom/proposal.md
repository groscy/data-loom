## Why

data_loom has no visual identity: the UI header shows the lowercase code name, the browser tab has no icon, and the packaged executable wears the generic Node binary icon. Giving the app a proper display name — **DataLoom** — and an app icon makes it recognizable in the browser tab, the taskbar, and on the Releases page, and signals that it's a finished tool rather than a script.

This is additive branding with no behavioral dependency on other capabilities, so it is a Phase 1 change.

## What Changes

- **Name**: present the product as **DataLoom** in all user-facing surfaces — the UI header, the page `<title>`, and the README. (The npm package id stays lowercase `data-loom` per npm naming rules; only the display/product name changes.)
- **App icon**: design a single vector app icon (an SVG evoking a woven loom + data nodes, in the existing accent palette) and use it as:
  - the **browser favicon**,
  - a small **logo in the header** beside the DataLoom name,
  - the **Windows executable icon** (set on `DataLoom.exe` during packaging).
- **Executable name**: the packaged artifact and the GitHub Release asset become `DataLoom.exe`.

## Capabilities

### New Capabilities
- `app-branding`: The product's visual identity — the display name "DataLoom" and a single app icon shown consistently as the browser favicon, the header logo, and the packaged executable's icon, with the executable named `DataLoom.exe`.

### Modified Capabilities
<!-- None. Branding is a new, self-contained concern; it adds the identity surfaces rather than changing existing roadmap/MCP behavior. -->

## Impact

- **UI**: header and `<title>` show "DataLoom"; `index.html` gains a favicon link and a header logo (the SVG icon). New asset `public/icon.svg`.
- **Packaging**: the build generates an `.ico` from the SVG and sets it on the executable (e.g. via `rcedit`), and outputs `DataLoom.exe`. Adds a small image toolchain (SVG→PNG→ICO) to the packaging dev-dependencies.
- **Release/docs**: the CI workflow publishes `DataLoom.exe`; the README refers to the app as DataLoom and to the `DataLoom.exe` download.
- No change to roadmap or MCP behavior; this is purely identity.
