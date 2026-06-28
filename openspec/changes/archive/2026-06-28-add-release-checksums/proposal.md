## Why

The released `DataLoom.exe` is unsigned, so Windows SmartScreen flags it as an unrecognized app and some antivirus engines false-positive on the Node SEA binary (an 84 MB `node.exe` plus an injected blob). Proper code signing is the real fix but is deferred — it needs a certificate or signing service and a cost/eligibility decision. As immediate, zero-cost mitigations we publish an integrity checksum with each release and give users honest guidance to verify the download and get past the SmartScreen prompt.

## What Changes

- The release workflow (`.github/workflows/release.yml`) computes a **SHA-256 checksum** of `build/DataLoom.exe` and publishes it as an additional release asset (`DataLoom.exe.sha256`) alongside the executable, on the same version tag.
- The README gains a short **"Verifying your download"** note: the exe is an unsigned open-source build; how to verify it against the published SHA-256 with PowerShell `Get-FileHash`; the SmartScreen **"More info → Run anyway"** step; and a line that code signing is the planned real fix.
- The README documents the one manual, per-release step a maintainer can take — submit the binary to Microsoft's Defender false-positive portal (<https://www.microsoft.com/wdsi/filesubmission>) — noting it is a manual web action, not automated by the workflow.

Non-goals (deliberately deferred): code signing of any kind (SignPath, Azure Trusted Signing, or buying an OV/EV certificate); automating the Defender submission; and any change to how the executable is built.

## Capabilities

### New Capabilities

_None._ (Extends the existing release pipeline.)

### Modified Capabilities

- `release-pipeline`: the release workflow additionally publishes a SHA-256 checksum asset for the executable on each version tag.

## Impact

- **CI**: `.github/workflows/release.yml` (a checksum step after the build; the `.sha256` file added to the publish step's `files:` list).
- **Docs**: `README.md` (verification + SmartScreen guidance, honest about what checksums do and do not solve).
- **Honesty constraint**: checksums verify integrity (the download was not tampered) — they do **not** remove the SmartScreen warning or AV flags. The README must say so plainly and frame code signing as the real fix still to come.
- **No new dependencies; the SEA build is unchanged.**
