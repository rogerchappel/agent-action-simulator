# agent-action-simulator

Use this skill when an agent has a proposed connector/tool action plan and needs to produce a dry-run approval report before any external side effect.

## Use when

- Reviewing CRM, project-management, messaging, or issue-tracker action batches.
- Checking whether planned fields require approval.
- Producing evidence for a human reviewer before a live connector call.
- Testing approval policies with fixtures.

## Required inputs

- Action-plan JSON with an `actions` array.
- Approval-policy JSON with explicit, valid rules. Wildcards must occupy the
  entire type or target value, and `needs_approval` rules must name an approval.

## Side-effect boundaries

- Reads local JSON only.
- Writes no files by default.
- Does not call connectors, APIs, browsers, message tools, or credential stores.
- Unknown action types are blocked by default.
- More-specific policy rules override broader wildcards regardless of order;
  conflicting equally specific matches are blocked.

## Approval requirements

Human or system approval is required outside this skill before executing any action classified as `needs_approval`. Actions classified as `blocked` must not be executed without changing the source policy and rerunning validation.

## Validation workflow

```sh
npm test
npm run check
npm run smoke
```

Attach the generated markdown report to the approval request or PR notes.
