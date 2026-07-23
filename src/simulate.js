const OUTCOMES = new Set(['allowed', 'needs_approval', 'blocked']);

export function simulatePlan(plan, policy) {
  validatePlan(plan);
  validatePolicy(policy);
  const results = plan.actions.map((action, index) => classifyValidatedAction(action, policy.rules, index));
  return {
    summary: summarize(results),
    results
  };
}

export function classifyAction(action, policy, index = 0) {
  validatePolicy(policy);
  return classifyValidatedAction(action, policy.rules, index);
}

export function validatePolicy(policy) {
  if (!isPlainObject(policy)) {
    throw new TypeError('Policy must be an object');
  }
  if (!Array.isArray(policy.rules)) {
    throw new TypeError('Policy rules must be an array');
  }

  policy.rules.forEach(validateRule);
}

export function validatePlan(plan) {
  if (!isPlainObject(plan)) {
    throw new TypeError('Plan must be an object');
  }
  if (!Array.isArray(plan.actions)) {
    throw new TypeError('Plan actions must be an array');
  }
}

function classifyValidatedAction(action, rules, index) {
  const malformed = validateActionShape(action, index);
  if (malformed) {
    return malformed;
  }

  const resolution = resolveRule(action, rules);
  if (!resolution) {
    return blocked(action, index, 'No matching policy rule');
  }
  if (resolution.conflict) {
    return blocked(action, index, `Conflicting policy rules at indexes ${resolution.indexes.join(', ')}`);
  }

  const { rule } = resolution;
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

function validateRule(rule, index) {
  if (!isPlainObject(rule)) {
    throw new TypeError(`Policy rule ${index} must be an object`);
  }

  validateSelector(rule.type, 'type', index);
  validateSelector(rule.target, 'target', index);

  if (!OUTCOMES.has(rule.outcome)) {
    throw new TypeError(`Policy rule ${index} outcome must be allowed, needs_approval, or blocked`);
  }

  if (rule.blockedFields !== undefined) {
    if (!Array.isArray(rule.blockedFields)) {
      throw new TypeError(`Policy rule ${index} blockedFields must be an array`);
    }
    const seen = new Set();
    for (const field of rule.blockedFields) {
      if (typeof field !== 'string' || field.length === 0 || field.trim() !== field || field.includes('*')) {
        throw new TypeError(`Policy rule ${index} blockedFields must contain non-empty exact field names`);
      }
      if (seen.has(field)) {
        throw new TypeError(`Policy rule ${index} has duplicate blockedFields entry: ${field}`);
      }
      seen.add(field);
    }
  }

  if (rule.outcome === 'needs_approval' && !isNonEmptyName(rule.approval)) {
    throw new TypeError(`Policy rule ${index} with needs_approval must have a non-empty approval name`);
  }
  if (rule.approval !== undefined && typeof rule.approval !== 'string') {
    throw new TypeError(`Policy rule ${index} approval must be a string`);
  }
  if (rule.reason !== undefined && typeof rule.reason !== 'string') {
    throw new TypeError(`Policy rule ${index} reason must be a string`);
  }
}

function validateSelector(value, field, index) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`Policy rule ${index} ${field} must be a non-empty string`);
  }
  if (value !== '*' && value.includes('*')) {
    throw new TypeError(`Policy rule ${index} ${field} wildcard must be the entire value`);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() === value;
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

function resolveRule(action, rules) {
  const matches = rules.map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => {
    const typeMatches = rule.type === action.type || rule.type === '*';
    const targetMatches = rule.target === action.target || rule.target === '*';
    return typeMatches && targetMatches;
  });

  if (matches.length === 0) {
    return null;
  }

  const highestSpecificity = Math.max(...matches.map(({ rule }) => specificity(rule)));
  const finalists = matches.filter(({ rule }) => specificity(rule) === highestSpecificity);
  const signatures = new Set(finalists.map(({ rule }) => enforcementSignature(rule)));
  if (signatures.size > 1) {
    return { conflict: true, indexes: finalists.map(({ index }) => index) };
  }
  return { conflict: false, rule: finalists[0].rule };
}

function specificity(rule) {
  return Number(rule.type !== '*') + Number(rule.target !== '*');
}

function enforcementSignature(rule) {
  return JSON.stringify({
    outcome: rule.outcome,
    approval: rule.approval ?? null,
    blockedFields: [...(rule.blockedFields ?? [])].sort()
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
