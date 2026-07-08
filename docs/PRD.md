# Product Requirements

## Goal

Help agents and reviewers inspect planned external actions before live connector writes by producing deterministic dry-run classifications.

## Non-goals

- No live connector execution.
- No credential discovery.
- No policy server integration.

## MVP requirements

1. Read an action-plan JSON file.
2. Read an approval-policy JSON file.
3. Classify actions as allowed, needs approval, blocked, or malformed.
4. Explain classification reasons and triggering fields.
5. Emit JSON and markdown reports.
6. Provide a reusable library API and CLI.

## Success criteria

- Fixture-backed tests cover every outcome.
- Smoke command produces a markdown reviewer report.
- Unknown action types are blocked by default.
