# Orchestration

## Inputs

- Action-plan JSON with an `actions` array.
- Approval-policy JSON with `rules` and optional `default`.

## Flow

1. Generate or collect a connector action plan.
2. Run `agent-action-simulator <actions.json> --policy <policy.json>`.
3. Review blocked and approval-required rows.
4. Update the source plan or collect approval before any live connector call.

## Side effects

The simulator is read-only. Reports are printed to stdout unless a caller redirects them.
