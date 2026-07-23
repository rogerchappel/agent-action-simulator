# agent-action-simulator

`agent-action-simulator` classifies planned connector actions before any live write happens. It compares an action-plan fixture with an approval policy and emits a reviewer-friendly dry-run report.

## Quickstart

```sh
npm install
npm test
npm run smoke
node src/cli.js fixtures/actions.json --policy fixtures/policy.json --format json
npm run release:check
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

## Action plans

An action plan must be a JSON object with an `actions` array. `null`, a
top-level array, an object without `actions`, and a non-array `actions` value
are rejected instead of being treated as successful zero-action reviews.
An explicitly empty plan is valid:

```json
{
  "actions": []
}
```

Each action is classified as `malformed` when it is not an object with string
`id`, `type`, and `target` values. When present, `fields` must be an object.

## Policy rules

Each rule requires a non-empty `type`, `target`, and supported `outcome`.
Use `"*"` as the entire type or target to match any value; embedded wildcards
such as `"message.*"` are rejected. `blockedFields`, when present, must be an
array of unique, non-empty exact field names. A `needs_approval` rule must also
name a non-empty `approval`.

```json
{
  "rules": [
    { "type": "*", "target": "*", "outcome": "blocked" },
    {
      "type": "message.send",
      "target": "*",
      "outcome": "needs_approval",
      "approval": "human-send-review"
    },
    { "type": "message.send", "target": "gmail", "outcome": "allowed" }
  ]
}
```

Matching is independent of rule order. The simulator chooses the matching rule
with the most exact selectors: exact type and target, then one exact selector,
then the double wildcard. If equally specific matching rules disagree on
`outcome`, `approval`, or `blockedFields`, the action is blocked as a policy
conflict. Equivalent rules may use different explanatory `reason` text; the
first equivalent rule supplies the report reason.

## Safety

The package never loads credentials and never calls a connector. It only reads local JSON files and writes the report to stdout.

## Limitations

- Policies are intentionally small JSON documents.
- Types and targets support whole-value wildcards; field names match exactly.
- The simulator is a preflight aid, not a substitute for connector-side authorization.

## Verify

```sh
npm run release:check
```

`npm run release:readiness` checks package metadata, the CLI bin target,
support docs, release fixtures, CI presence, and the npm files allowlist.
`npm run package:smoke` dry-runs the npm tarball and fails if release-critical
files would be omitted.
