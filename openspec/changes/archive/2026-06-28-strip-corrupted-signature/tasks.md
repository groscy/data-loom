## 1. Release workflow

- [x] 1.1 In `.github/workflows/release.yml`, add a step after "Build standalone executable" that makes `build/DataLoom.exe` cleanly unsigned by clearing its PE certificate-table directory entry (`IMAGE_DIRECTORY_ENTRY_SECURITY`): parse the PE header to locate the entry, write 8 zero bytes over its (offset, size), and fail the step if the file is not a PE, the optional-header magic is unexpected, the entry is still non-empty afterward, or `Get-AuthenticodeSignature` does not report `NotSigned`. (`signtool remove` was tried first and fails on the invalid residue — `CryptSIPRemoveSignedDataMsg ... parameter is incorrect` — so the entry is cleared directly.)
- [x] 1.2 Ensure the existing "Generate SHA-256 checksum" step runs AFTER the new strip step, so the published `DataLoom.exe.sha256` is computed over the stripped bytes (inserting the strip step between the build and checksum steps satisfies this; the publish step is unchanged). Verified step order: Build → Strip → Checksum → Publish.

## 2. Verification

- [x] 2.1 Validate `release.yml` parses as YAML and the strip step's PowerShell is well-formed — `npx js-yaml` parses (exit 0); step order confirmed; the exact step body was extracted from the YAML and executed without error.
- [x] 2.2 Reproduce the strip mechanism locally on Windows against a real `npm run package` (postject-injected) exe: the security directory went `(84445696, 10384) → (0, 0)` (independently re-parsed), Authenticode status `NotSigned`, the stripped SEA binary still executed to `[data-loom] dashboard ready`, the SHA-256 reproduced deterministically, and the README verifier one-liner returned `True` against the published `DataLoom.exe.sha256`.
- [x] 2.3 Confirm fail-closed behavior: running the exact strip body against a non-PE input throws (`not a PE file`) and exits non-zero, so the release would publish nothing.
