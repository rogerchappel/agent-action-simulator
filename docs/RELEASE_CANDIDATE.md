# Release Candidate Notes

## Classification

ship

## Verification plan

- `npm test` - pass, 2 tests
- `npm run check` - pass
- `npm run smoke` - pass, markdown report covers all outcomes
- `node src/cli.js fixtures/actions.json --policy fixtures/policy.json --format json` - pass

## Dry-run guarantees

- Reads only caller-supplied local JSON.
- Emits reports to stdout.
- Does not call connectors, load credentials, send messages, mutate tickets, or write remote state.
- Unknown action types fail closed as `blocked`.

## Known limitations

- Policy matching is exact and intentionally simple.
- Field sensitivity is configured per rule with `blockedFields`.
- The tool explains approval needs but does not collect approval.
