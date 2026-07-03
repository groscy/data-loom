## ADDED Requirements

### Requirement: Connect provisions the weave alias
`data-loom connect claude-code` SHALL, after registering the MCP endpoint, also write the version-stamped `/loom:weave` alias into the user's global Claude commands directory — so a fresh install gains both the tools and the command in the same session reload. This provisioning SHALL be best-effort in the same way as the registration: a failure to write the alias SHALL warn and not fail the connect. `data-loom disconnect claude-code` SHALL remove the alias when the file at the target path is identified as DataLoom's (by its version stamp), leaving files it does not recognize untouched.

#### Scenario: Connect writes the alias
- **WHEN** the user runs `data-loom connect claude-code`
- **THEN** the MCP registration is created and the `/loom:weave` alias file is written, and one reload later both the tools and the command are available

#### Scenario: Alias write failure does not fail connect
- **WHEN** `connect claude-code` registers successfully but cannot write the alias file
- **THEN** the command warns about the alias and still reports the registration as successful

#### Scenario: Disconnect removes our alias
- **WHEN** the user runs `data-loom disconnect claude-code` and the alias file carries DataLoom's version stamp
- **THEN** the alias file is removed along with the registration

#### Scenario: Unrecognized file is preserved
- **WHEN** the user runs `data-loom disconnect claude-code` and the file at the alias path is not identified as DataLoom's
- **THEN** the file is left untouched
