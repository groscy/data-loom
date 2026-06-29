## Context

`DataLoom.exe` is a Node SEA binary published by `release.yml` on each `v*` tag. The build (`scripts/build-exe.mjs`) copies the official Node binary — which OpenJS Foundation Authenticode-signs — and uses `postject` to inject the SEA blob into it. `postject` prints `warning: The signature seems corrupted!`.

Inspecting the real build artifact shows what that actually leaves behind. The original `node.exe` has its certificate table as the last 10,384 bytes, referenced by the PE `IMAGE_DIRECTORY_ENTRY_SECURITY` directory entry (offset 84,445,696, size 10,384). After `postject` grows the file to ~85.8 MB, **that directory entry still reads (offset 84,445,696, size 10,384)** — but those bytes are no longer a valid PKCS#7 signature. So:

- Windows Authenticode already reports the file as `NotSigned` (it cannot parse a signature there).
- The PE nonetheless still *advertises* a 10,384-byte certificate table — a dangling, non-empty entry that AV heuristics read as a tampered/broken signature, which is worse than a plainly unsigned binary.

Code signing is the real fix for SmartScreen but is out of scope here (cost / eligibility); this change only removes the dead certificate-table entry. The prior archived change `add-release-checksums` added the SHA-256 checksum step that this change must reorder.

## Goals / Non-Goals

**Goals:**
- Publish a cleanly **unsigned** `DataLoom.exe` whose PE declares no certificate table (security directory entry = 0/0), instead of advertising a corrupted one, to reduce AV false positives at zero cost.
- Keep the published `DataLoom.exe.sha256` matching the published exe by computing it **after** the strip.
- Fail the release if the strip cannot be done, rather than silently regressing.

**Non-Goals:**
- Code signing of any kind (SignPath / Azure Trusted Signing / OV / EV) — a separate, larger change.
- Silencing SmartScreen (only a real signature does that) or changing the README (its current guidance stays accurate).
- Touching the SEA build (`scripts/build-exe.mjs`) or scrubbing the now-orphaned certificate bytes from the file body.

## Decisions

### 1. Strip in `release.yml`, not in `build-exe.mjs`
The strip is a release-pipeline concern; keeping it in the workflow keeps the change minimal and isolated to CI, leaving the build script (and local `npm run package` for dev) untouched. The published artifact only comes from CI, so stripping in CI fully covers the release. (A considered alternative — strip the copied `node.exe`'s signature *before* `postject` injects, inside `build-exe.mjs` — would also silence the `postject` warning and leave no orphaned cert bytes, but it widens the change into the cross-platform build path and shifts the work out of the `release-pipeline` capability. Deferred.)

### 2. Clear the certificate-table directory entry directly, not `signtool remove`
The natural first choice, `signtool remove /s`, **does not work** on this artifact: there is no valid signature to remove, so it errors (`CryptSIPRemoveSignedDataMsg returned error: 0x00000057 — The parameter is incorrect`, exit 1) and leaves the file unchanged. This was confirmed against the real `postject` output. Removing an *invalid* certificate-table reference is instead done structurally: parse the PE header (`e_lfanew` → optional-header magic → data directories), locate `IMAGE_DIRECTORY_ENTRY_SECURITY` (index 4), and write 8 zero bytes over its (offset, size). The PE then declares no certificate table — the standard definition of "unsigned".

Alternatives considered:
- **`signtool remove /s`** — rejected: errors on the invalid residue (verified).
- **`osslsigncode remove-signature`** — robust in general, but not preinstalled (needs `choco install`), and its behavior on an already-corrupted entry is unverified; rejected for adding a dependency over a self-contained 8-byte edit.

Verified locally on Windows against a real `postject`-injected exe: the security directory went `(84445696, 10384) → (0, 0)`, Authenticode status `NotSigned`, the stripped SEA binary still ran to `[data-loom] dashboard ready`, and the SHA-256 reproduced deterministically (same hash across independent runs).

### 3. Resolve the directory-entry offset by parsing the PE, with explicit guards
The security directory entry's file offset is `e_lfanew + 24 + (112 or 96 by optional-header magic) + 32`. The step reads `e_lfanew` at `0x3C`, verifies the `PE\0\0` NT signature, and branches on magic `0x20b` (PE32+) vs `0x10b` (PE32); any unexpected magic or a missing NT signature throws. This avoids hard-coding offsets and fails loudly on an unexpected binary shape.

### 4. Fail closed
If the file is not a PE, the optional-header magic is unexpected, or the security directory entry is still non-empty after the write (or Authenticode is not `NotSigned`), the step throws and the job fails — no asset is published. This mirrors the existing "Build failure publishes nothing" requirement and prevents a silent regression to a corrupted-signature download. Verified: feeding a non-PE input exits non-zero.

### 5. Reorder the checksum after the strip
Stripping changes the exe bytes, so the existing "Generate SHA-256 checksum" step must run after the strip to keep `DataLoom.exe.sha256` matching the published exe. Inserting the strip step between "Build standalone executable" and the checksum step achieves the ordering with no other moves; the publish step is unchanged.

## Risks / Trade-offs

- **Orphaned certificate bytes remain in the file body.** Clearing only the directory entry leaves the ~10 KB of now-unreferenced cert data embedded (it is not at end-of-file — blob data follows it — so it cannot simply be truncated). → Accepted: the AV signal is the *non-empty certificate-table directory entry*, which is removed; the unreferenced bytes are inert. Scrubbing them risks touching section/blob data and exceeds "smallest change". A future build-side strip (decision 1's alternative) would avoid them entirely.
- **Hand-editing PE bytes is unusual in a workflow.** → Mitigated by explicit PE-structure guards, a post-write verification that re-reads the entry, and an Authenticode `NotSigned` assertion; all paths fail closed. The exact step body was extracted from the YAML and executed against a real artifact.
- **Stale PE checksum / no recompute.** The optional-header `CheckSum` is not recomputed after the edit. → It was already stale after `postject` and is not validated by the user-mode loader; no regression.
- **Misread as a SmartScreen fix.** It is not, and the proposal/spec say so; SmartScreen is unchanged and the README is deliberately left as-is.
- **Marginal benefit.** This reduces AV false positives but does not remove SmartScreen; it is hygiene, not the real fix. → Accepted and stated; code signing remains the follow-up.

## Open Questions

- None outstanding. The mechanism, offset math, and fail-closed behavior were verified end-to-end against the real build artifact before finalizing.
