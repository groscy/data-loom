## Context

`DataLoom.exe` is an unsigned Node SEA binary published by `release.yml` on each `v*` tag. Windows SmartScreen flags it as an unrecognized app, and some AV engines false-positive on the packed binary. Code signing is the real fix but requires a certificate or signing service (cost / eligibility), so it is deferred. This change ships the free, immediate mitigations only.

## Goals / Non-Goals

**Goals:**
- Publish a SHA-256 checksum with every release so users can verify download integrity.
- Give users honest, actionable guidance: how to verify, how to get past SmartScreen, and that signing is the real fix still to come.

**Non-Goals:**
- Code signing (SignPath / Azure Trusted Signing / OV / EV) — a separate, larger change needing a cert + CI secrets.
- Automating Microsoft's Defender false-positive submission (manual web action).
- Changing how the executable is built.

## Decisions

### 1. Checksums are integrity, not trust — and the README says so
A checksum proves the download was not tampered in transit; it does **not** remove the SmartScreen warning or AV flags. The README must state this plainly so users are not misled into thinking the checksum "makes it safe to ignore the warning." Code signing is framed as the planned real fix.

### 2. Generate on the Windows runner, attach via the existing release action
Add a step after the build that writes `build/DataLoom.exe.sha256` (PowerShell `Get-FileHash -Algorithm SHA256`), then add that file to the `softprops/action-gh-release` `files:` list. `fail_on_unmatched_files: true` stays valid because both files exist by publish time.

### 3. A verifiable, documented checksum format
The checksum file content and the README's verification command must agree, so a user can run one PowerShell line (`Get-FileHash`) and compare against the published value. Keep the format simple (the hash, and ideally the filename).

## Risks / Trade-offs

- **Users read "checksum" as "safe / ignore the warning."** → Mitigation: explicit README wording separating integrity (what the checksum gives) from publisher trust (what only signing gives).
- **Asset/filename mismatch breaks `fail_on_unmatched_files`.** → Mitigation: the checksum step writes a fixed path that matches the `files:` entry exactly; verified by a green release run.
- **Marginal benefit.** Checksums + "Run anyway" guidance do not silence SmartScreen; this is interim relief, not the fix. → Accepted and stated; the signing change is the follow-up.

## Open Questions

- Checksum file format: bare hash vs `Get-FileHash` output vs `<hash>  DataLoom.exe`. Leaning a simple, clearly documented format the README's one-liner verifies. To finalize in implementation.
