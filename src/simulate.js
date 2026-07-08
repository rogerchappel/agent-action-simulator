const OUTCOMES = new Set(['allowed', 'needs_approval', 'blocked']);

export function simulatePlan(plan, policy) {
  const actions = Array.isArray(plan?.actions) ? plan.actions : [];
  return {
    summary: summarize(actions.map((action, index) => classifyAction(action, policy, index))),
    results: actions.map((action, index) => classifyAction(action, policy, index))
  };
}

export function classifyAction(action, policy, index = 0) {
  const malformed = validateActionShape(action, index);
  if (malformed) {
    return malformed;
  }

  const rule = findRule(action, policy);
  if (!rule) {
    return blocked(action, index, 'No matching policy rule');
  }

  if (!OUTCOMES.has(rule.outcome)) {
    return blocked(action, index, `Invalid policy outcome: ${rule.outcome}`);
  }

  const riskyFields = findRiskyFields(action, rule);
  if (riskyFields.length > 0) {
    return {
      index,
      id: action.id,
      type: action.type,
      target: action.target,
      outcome: 'blocked',
      reason: 'Action contains blocked fields',
      fields: riskyFields
    };
  }

  return {
    index,
    id: action.id,
    type: action.type,
    target: action.target,
    outcome: rule.outcome,
    reason: rule.reason ?? defaultReason(rule.outcome),
    approval: rule.approval ?? null,
    fields: Object.keys(action.fields ?? {}).sort()
  };
}

function validateActionShape(action, index) {
  if (!action || typeof action !== 'object') {
    return malformed(index, 'Action must be an object');
  }
  for (const key of ['id', 'type', 'target']) {
    if (!action[key] || typeof action[key] !== 'string') {
      return malformed(index, `Action missing string ${key}`);
    }
  }
  if (action.fields !== undefined && (!action.fields || typeof action.fields !== 'object' || Array.isArray(action.fields))) {
    return malformed(index, 'Action fields must be an object');
  }
  return null;
}

function findRule(action, policy) {
  const rules = Array.isArray(policy?.rules) ? policy.rules : [];
  return rules.find((rule) => {
    const typeMatches = rule.type === action.type || rule.type === '*';
    const targetMatches = rule.target === action.target || rule.target === '*';
    return typeMatches && targetMatches;
  });
}

function findRiskyFields(action, rule) {
  const blockedFields = new Set(rule.blockedFields ?? []);
  return Object.keys(action.fields ?? {})
    .filter((field) => blockedFields.has(field))
    .sort();
}

function malformed(index, reason) {
  return { index, id: null, type: null, target: null, outcome: 'malformed', reason, fields: [] };
}

function blocked(action, index, reason) {
  return {
    index,
    id: action.id,
    type: action.type,
    target: action.target,
    outcome: 'blocked',
    reason,
    fields: Object.keys(action.fields ?? {}).sort()
  };
}

function summarize(results) {
  const summary = { allowed: 0, needs_approval: 0, blocked: 0, malformed: 0 };
  for (const result of results) {
    summary[result.outcome] += 1;
  }
  return summary;
}

function defaultReason(outcome) {
  if (outcome === 'allowed') {
    return 'Allowed by policy';
  }
  if (outcome === 'needs_approval') {
    return 'Approval required by policy';
  }
  return 'Blocked by policy';
}
