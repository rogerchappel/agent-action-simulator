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

The package is not published to the npm registry yet. Until the first release,
clone this repository and use the source-checkout commands in Quickstart above.
After publication, the registry install will be:

```sh
npm install agent-action-simulator
npx agent-action-simulator fixtures/actions.json --policy fixtures/policy.json
npx agent-action-simulator --help
npx agent-action-simulator --version
```

`--policy` is required for simulations and may be specified once. The optional
`--format` flag may also be specified once and accepts `json` or `markdown`.
Repeated options and unsupported formats are rejected before any input files
are read. `--help` and `--version` are standalone commands; combining either
with a plan path or any other option is an error.

## Outcomes

- `allowed`: policy permits the action without extra approval
- `needs_approval`: policy permits the action only after a named approval
- `blocked`: action type, target, or field is disallowed or unknown
- `malformed`: action lacks required shape

## Action plans

An action plan must be a JSON object containing only an `actions` array. `null`, a
top-level array, an object without `actions`, and a non-array `actions` value
are rejected instead of being treated as successful zero-action reviews.
Unknown top-level properties are rejected, so misspelled controls cannot turn
into an incomplete successful review. Action `id` values must be unique within
the plan so every reported decision has an unambiguous identity.
An explicitly empty plan is valid:

```json
{
  "actions": []
}
```

Each action is classified as `malformed` when it is not an object with
non-empty exact-string `id`, `type`, and `target` values. These values are not
trimmed: leading or trailing whitespace makes the action malformed. When
present, `fields` must be an object. Actions accept only `id`, `type`, `target`,
and `fields`; unknown properties are rejected with the action index and property
name before a report is emitted.

## Policy rules

Each rule requires a non-empty `type`, `target`, and supported `outcome`.
Rules accept only the properties `type`, `target`, `outcome`, `blockedFields`,
`approval`, and `reason`; unknown properties are rejected with the rule index
and property name so misspelled enforcement controls cannot be ignored.
Use `"*"` as the entire type or target to match any value; embedded wildcards
such as `"message.*"` are rejected. `blockedFields`, when present, must be an
array of unique, non-empty exact field names. The `approval` property is valid
only on `needs_approval` rules, where it is required and must be a non-empty
exact name. `allowed` and `blocked` rules must omit `approval`.

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
support docs, release fixtures, the Node 20 and Node 26 CI matrix, and the npm
files allowlist. Node 20 is the declared minimum runtime; Node 26 provides
coverage on the current maintained release. Both CI jobs run the complete
`npm run release:check` command.
`npm run package:smoke` dry-runs the npm tarball and fails if release-critical
files would be omitted.
