# Release Candidate Notes

## Classification

ship

## Verification plan

- `npm run release:check` - pass; validates release readiness and syntax, runs the full automated test suite and source smoke, then packs a real tarball into a disposable directory
- Package consumer smoke - pass; installs the tarball into a clean consumer with lifecycle scripts disabled, invokes the installed CLI's `--help` and `--version`, and imports every documented public export
- Temporary package and consumer files are removed whether verification succeeds or fails

## Dry-run guarantees

- Reads only caller-supplied local JSON.
- Emits reports to stdout.
- Does not call connectors, load credentials, send messages, mutate tickets, or write remote state.
- Unknown action types fail closed as `blocked`.

## Known limitations

- Policy matching is exact and intentionally simple.
- Field sensitivity is configured per rule with `blockedFields`.
- The tool explains approval needs but does not collect approval.
