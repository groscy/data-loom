## Why

The released `DataLoom.exe` is built with Node SEA: `postject` injects the SEA blob into a copy of the official Node binary, which is Authenticode-signed by the OpenJS Foundation. Injecting the blob breaks that inherited signature — `postject` logs `warning: The signature seems corrupted!`. The published exe therefore still advertises a certificate table in its PE header (a *dangling* certificate-table directory entry pointing at ~10 KB that is no longer a valid signature) instead of cleanly declaring none. Windows already reports the file as `NotSigned`, but a non-empty-yet-invalid certificate-table entry is a classic "tampered signed binary" tell that some antivirus engines flag — worse than a plainly unsigned binary. Clearing that dead entry is a free, zero-cost cleanup that removes the red flag.

## What Changes

- The release workflow (`.github/workflows/release.yml`) gains a **strip step** after `npm run package` that clears the PE certificate-table directory entry of `build/DataLoom.exe`, leaving the binary cleanly unsigned (no certificate table), and asserts the result is `NotSigned`. (`signtool remove` cannot be used here: the residue is not a valid signature, so signtool errors on it — `CryptSIPRemoveSignedDataMsg ... The parameter is incorrect`. The step instead clears the 8-byte directory entry directly via the PE header.)
- The existing **"Generate SHA-256 checksum"** step moves to run **after** the strip step. Stripping changes the exe bytes, so the checksum must be computed on the stripped binary to keep matching the published download (today the checksum runs immediately after the build).

Non-goals (deliberately out of scope): code signing of any kind (SignPath, Azure Trusted Signing, or an OV/EV certificate); changing how the executable is built (`scripts/build-exe.mjs` is untouched); and any change to the README. Clearing the dead signature does **not** silence the SmartScreen "unrecognized app" warning — only real code signing does — so the README's existing "unsigned build / SmartScreen / checksum" guidance stays accurate as-is.

## Capabilities

### New Capabilities

_None._ (Extends the existing release pipeline.)

### Modified Capabilities

- `release-pipeline`: on a release build, the workflow clears the invalid inherited certificate-table entry from the executable before publishing, and computes the published checksum over the stripped bytes.

## Impact

- **CI**: `.github/workflows/release.yml` only — a strip step inserted between "Build standalone executable" and "Generate SHA-256 checksum", which reorders the checksum to run after the strip.
- **Ordering constraint**: the checksum step MUST run after the strip step. If it runs before, the published `DataLoom.exe.sha256` would no longer match the published exe — the prior `add-release-checksums` guarantee would break.
- **Honesty constraint**: this reduces AV false positives by making the binary honestly unsigned (no certificate table); it does **not** remove SmartScreen or change anything users do. No README change is needed and none is made.
- **No new dependencies**: the strip is a few lines of in-place PowerShell that clear the PE certificate-table directory entry — no external tool. The SEA build is unchanged.
