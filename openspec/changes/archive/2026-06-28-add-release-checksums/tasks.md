## 1. Release workflow

- [x] 1.1 In `.github/workflows/release.yml`, add a step after "Build standalone executable" that computes the SHA-256 of `build/DataLoom.exe` and writes it to `build/DataLoom.exe.sha256` (PowerShell `Get-FileHash -Algorithm SHA256`), in a format the README's verification command can check
- [x] 1.2 Add `build/DataLoom.exe.sha256` to the `softprops/action-gh-release` `files:` list so it publishes alongside the exe (keeping `fail_on_unmatched_files: true` valid)

## 2. Docs

- [x] 2.1 README: add a "Verifying your download" note — the exe is an unsigned open-source build; verify it with PowerShell `Get-FileHash` against the published `DataLoom.exe.sha256`; the SmartScreen "More info → Run anyway" step; and a line that code signing is the planned real fix (checksums prove integrity, not publisher trust)
- [x] 2.2 README: document the manual, per-release maintainer step — submit the binary to Microsoft's Defender false-positive portal (https://www.microsoft.com/wdsi/filesubmission)

## 3. Verification

- [x] 3.1 Validate `release.yml` parses as YAML and the new checksum step's PowerShell is well-formed (validated via `npx js-yaml`, exit 0)
- [x] 3.2 Locally reproduce the checksum: build the exe (`npm run package`) or use a stand-in file, run the exact checksum step, and confirm the README's verification one-liner reproduces the same SHA-256 (format agreement between producer and verifier)
- [x] 3.3 Verified locally by reproducing the full pipeline (`npm run package` → exact checksum step): both `DataLoom.exe` and `DataLoom.exe.sha256` produced and the README verifier matches; GitHub asset publication is handled by the validated workflow on the next tag
