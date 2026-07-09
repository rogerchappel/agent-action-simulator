# agent-action-simulator

`agent-action-simulator` classifies planned connector actions before any live write happens. It compares an action-plan fixture with an approval policy and emits a reviewer-friendly dry-run report.

## Quickstart

```sh
npm install
npm test
npm run smoke
node src/cli.js fixtures/actions.json --policy fixtures/policy.json --format json
```

## Install

```sh
npm install agent-action-simulator
npx agent-action-simulator fixtures/actions.json --policy fixtures/policy.json
npx agent-action-simulator --help
npx agent-action-simulator --version
```

## Outcomes

- `allowed`: policy permits the action without extra approval
- `needs_approval`: policy permits the action only after a named approval
- `blocked`: action type, target, or field is disallowed or unknown
- `malformed`: action lacks required shape

## Safety

The package never loads credentials and never calls a connector. It only reads local JSON files and writes the report to stdout.

## Limitations

- Policies are intentionally small JSON documents.
- Matching is exact by action type, target, and field names.
- The simulator is a preflight aid, not a substitute for connector-side authorization.

## Verify

```sh
npm run release:check
```
