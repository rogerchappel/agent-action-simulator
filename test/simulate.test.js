import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyAction, simulatePlan } from '../src/simulate.js';
import { formatJsonReport, formatMarkdownReport } from '../src/report.js';

const policy = {
  rules: [
    { type: 'crm.note.create', target: 'hubspot', outcome: 'allowed' },
    { type: 'crm.deal.update', target: 'hubspot', outcome: 'needs_approval', approval: 'sales-review' },
    { type: 'message.send', target: '*', outcome: 'needs_approval', approval: 'send-review', blockedFields: ['bcc'] }
  ]
};

test('rejects duplicate action identities before classification', () => {
  assert.throws(() => simulatePlan({
    actions: [
      { id: 'same', type: 'crm.note.create', target: 'hubspot' },
      { id: 'same', type: 'message.send', target: 'gmail' }
    ]
  }, policy), /duplicate action id: same/u);
});

test('rejects unknown plan and action control properties', () => {
  assert.throws(
    () => simulatePlan({ actons: [], actions: [] }, policy),
    /Plan has unknown property: actons/u
  );
  assert.throws(() => simulatePlan({
    actions: [{ id: 'a1', type: 'crm.note.create', target: 'hubspot', feilds: {} }]
  }, policy), /Plan action 0 has unknown property: feilds/u);
});

test('rejects unknown top-level policy controls through both exported APIs', () => {
  const policyWithTypo = { ...policy, rulez: [] };
  const action = { id: 'a1', type: 'crm.note.create', target: 'hubspot', fields: {} };

  assert.throws(
    () => simulatePlan({ actions: [action] }, policyWithTypo),
    /Policy has unknown property: rulez/u
  );
  assert.throws(
    () => classifyAction(action, policyWithTypo),
    /Policy has unknown property: rulez/u
  );
});

test('rejects unknown action controls through the single-action API', () => {
  const actionWithTypo = {
    id: 'a1',
    type: 'message.send',
    target: 'gmail',
    fields: {},
    outcomme: 'allowed'
  };

  assert.throws(
    () => classifyAction(actionWithTypo, policy),
    /Action has unknown property: outcomme/u
  );
});

test('classifies all supported outcomes', () => {
  const result = simulatePlan({
    actions: [
      { id: 'a1', type: 'crm.note.create', target: 'hubspot', fields: { body: 'ok' } },
      { id: 'a2', type: 'crm.deal.update', target: 'hubspot', fields: { stage: 'proposal' } },
      { id: 'a3', type: 'message.send', target: 'gmail', fields: { to: 'x@example.com', bcc: 'y@example.com' } },
      { id: 'a4', type: 'calendar.delete', target: 'google', fields: { eventId: '1' } },
      { id: 'a5', target: 'jira', fields: [] }
    ]
  }, policy);

  assert.deepEqual(result.summary, {
    allowed: 1,
    needs_approval: 1,
    blocked: 2,
    malformed: 1
  });
  assert.equal(result.results[1].approval, 'sales-review');
  assert.deepEqual(result.results[2].fields, ['bcc']);
  assert.equal(result.results[3].reason, 'No matching policy rule');
  assert.equal(result.results[4].reason, 'Action type must be a non-empty exact string');
});

test('exposes approval only for needs_approval results', () => {
  const result = simulatePlan({
    actions: [
      { id: 'allowed', type: 'read', target: 'crm', fields: {} },
      { id: 'review', type: 'write', target: 'crm', fields: {} },
      { id: 'blocked', type: 'delete', target: 'crm', fields: {} }
    ]
  }, {
    rules: [
      { type: 'read', target: 'crm', outcome: 'allowed' },
      { type: 'write', target: 'crm', outcome: 'needs_approval', approval: 'owner-review' },
      { type: 'delete', target: 'crm', outcome: 'blocked' }
    ]
  });

  assert.deepEqual(result.results.map(({ outcome, approval }) => ({ outcome, approval })), [
    { outcome: 'allowed', approval: null },
    { outcome: 'needs_approval', approval: 'owner-review' },
    { outcome: 'blocked', approval: null }
  ]);
});

test('accepts an explicitly empty action plan', () => {
  assert.deepEqual(simulatePlan({ actions: [] }, policy), {
    summary: { allowed: 0, needs_approval: 0, blocked: 0, malformed: 0 },
    results: []
  });
});

test('requires non-empty exact action identity strings', () => {
  const validAction = { id: 'send-1', type: 'message.send', target: 'gmail', fields: {} };

  for (const field of ['id', 'type', 'target']) {
    for (const value of ['', '   ', ` ${validAction[field]}`, `${validAction[field]} `]) {
      const action = { ...validAction, [field]: value };
      const result = simulatePlan({ actions: [action] }, policy);

      assert.equal(result.summary.malformed, 1, `${field}=${JSON.stringify(value)}`);
      assert.equal(result.results[0].outcome, 'malformed');
      assert.equal(result.results[0].reason, `Action ${field} must be a non-empty exact string`);
    }
  }

  assert.equal(simulatePlan({ actions: [validAction] }, policy).results[0].outcome, 'needs_approval');
});

test('rejects malformed top-level plans', () => {
  const malformedPlans = [
    [null, /plan must be an object/iu],
    [[], /plan must be an object/iu],
    [{}, /plan actions must be an array/iu],
    [{ actions: null }, /plan actions must be an array/iu],
    [{ actions: {} }, /plan actions must be an array/iu]
  ];

  for (const [candidate, expected] of malformedPlans) {
    assert.throws(() => simulatePlan(candidate, policy), expected);
  }
});

test('prefers exact rules over broad wildcards regardless of rule order', () => {
  const action = { id: 'send-1', type: 'message.send', target: 'gmail', fields: {} };
  const exact = { type: 'message.send', target: 'gmail', outcome: 'blocked' };
  const wildcard = { type: '*', target: '*', outcome: 'allowed' };

  for (const rules of [[wildcard, exact], [exact, wildcard]]) {
    const result = simulatePlan({ actions: [action] }, { rules });
    assert.equal(result.results[0].outcome, 'blocked');
  }
});

test('uses partial wildcards by specificity', () => {
  const result = simulatePlan({
    actions: [
      { id: 'gmail', type: 'message.send', target: 'gmail', fields: {} },
      { id: 'slack', type: 'message.send', target: 'slack', fields: {} },
      { id: 'other', type: 'calendar.read', target: 'google', fields: {} }
    ]
  }, {
    rules: [
      { type: '*', target: '*', outcome: 'blocked' },
      { type: 'message.send', target: '*', outcome: 'needs_approval', approval: 'send-review' },
      { type: 'message.send', target: 'gmail', outcome: 'allowed' }
    ]
  });

  assert.deepEqual(result.results.map(({ outcome }) => outcome), [
    'allowed',
    'needs_approval',
    'blocked'
  ]);
});

test('blocks an action when equally specific matching rules conflict', () => {
  const result = simulatePlan({
    actions: [{ id: 'send-1', type: 'message.send', target: 'gmail', fields: {} }]
  }, {
    rules: [
      { type: 'message.send', target: '*', outcome: 'allowed' },
      { type: '*', target: 'gmail', outcome: 'blocked' }
    ]
  });

  assert.equal(result.results[0].outcome, 'blocked');
  assert.match(result.results[0].reason, /conflicting policy rules/iu);
});

test('accepts equivalent equally specific matching rules', () => {
  const result = simulatePlan({
    actions: [{ id: 'send-1', type: 'message.send', target: 'gmail', fields: {} }]
  }, {
    rules: [
      { type: 'message.send', target: '*', outcome: 'blocked', reason: 'type policy' },
      { type: '*', target: 'gmail', outcome: 'blocked', reason: 'target policy' }
    ]
  });

  assert.equal(result.results[0].outcome, 'blocked');
  assert.equal(result.results[0].reason, 'type policy');
});

test('rejects malformed policies before classifying actions', () => {
  const plan = { actions: [{ id: 'a1', type: 'message.send', target: 'gmail', fields: {} }] };
  const malformedPolicies = [
    [null, /policy must be an object/iu],
    [{}, /policy rules must be an array/iu],
    [{ rules: [null] }, /rule 0 must be an object/iu],
    [{ rules: [{ type: '', target: 'gmail', outcome: 'blocked' }] }, /rule 0 type/iu],
    [{ rules: [{ type: 'message.*', target: 'gmail', outcome: 'blocked' }] }, /wildcard/iu],
    [{ rules: [{ type: 'message.send', target: 'g*', outcome: 'blocked' }] }, /wildcard/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'permit' }] }, /outcome/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'blocked', blockedFields: 'bcc' }] }, /blockedFields/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'blocked', blockedFields: [''] }] }, /blockedFields/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'blocked', blockedFields: ['bcc', 'bcc'] }] }, /duplicate blockedFields/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'blocked', blockedFields: ['*'] }] }, /blockedFields/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'needs_approval' }] }, /non-empty approval/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'needs_approval', approval: '  ' }] }, /non-empty approval/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'allowed', approval: 'owner-review' }] }, /allowed must not have an approval name/iu],
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'blocked', approval: 'owner-review' }] }, /blocked must not have an approval name/iu]
  ];

  for (const [candidate, expected] of malformedPolicies) {
    assert.throws(() => simulatePlan(plan, candidate), expected);
  }
});

test('rejects unknown policy rule properties for every outcome', () => {
  const plan = { actions: [{ id: 'a1', type: 'message.send', target: 'gmail', fields: {} }] };
  const rules = [
    { type: 'message.send', target: 'gmail', outcome: 'allowed', audit: true },
    { type: 'message.send', target: 'gmail', outcome: 'needs_approval', approval: 'owner-review', approver: 'owner' },
    { type: 'message.send', target: 'gmail', outcome: 'blocked', denyReason: 'restricted' }
  ];

  rules.forEach((rule, index) => {
    const unknownProperty = ['audit', 'approver', 'denyReason'][index];
    assert.throws(
      () => simulatePlan(plan, { rules: [
        { type: '*', target: '*', outcome: 'blocked' },
        rule
      ] }),
      new RegExp(`policy rule 1 has unknown property: ${unknownProperty}`, 'iu')
    );
  });
});

test('rejects a misspelled blockedFields control instead of allowing the action', () => {
  const plan = {
    actions: [{ id: 'send-1', type: 'message.send', target: 'gmail', fields: { bcc: 'hidden@example.com' } }]
  };
  const policyWithTypo = {
    rules: [{ type: 'message.send', target: 'gmail', outcome: 'allowed', blockedField: ['bcc'] }]
  };

  assert.throws(
    () => simulatePlan(plan, policyWithTypo),
    /policy rule 0 has unknown property: blockedField/iu
  );
});

test('renders markdown reviewer report', () => {
  const result = simulatePlan({
    actions: [
      { id: 'a1', type: 'crm.note.create', target: 'hubspot', fields: { body: 'ok' } }
    ]
  }, policy);

  assert.match(formatMarkdownReport(result), /# Agent Action Simulation/u);
  assert.match(formatMarkdownReport(result), /a1: allowed/u);
});

test('reports approval semantics consistently in markdown and JSON', () => {
  const result = simulatePlan({
    actions: [
      { id: 'allowed', type: 'read', target: 'crm', fields: {} },
      { id: 'review', type: 'write', target: 'crm', fields: {} },
      { id: 'blocked', type: 'delete', target: 'crm', fields: {} }
    ]
  }, {
    rules: [
      { type: 'read', target: 'crm', outcome: 'allowed' },
      { type: 'write', target: 'crm', outcome: 'needs_approval', approval: 'owner-review' },
      { type: 'delete', target: 'crm', outcome: 'blocked' }
    ]
  });

  const markdown = formatMarkdownReport(result);
  assert.match(markdown, /allowed: allowed - Allowed by policy\./u);
  assert.match(markdown, /review: needs_approval - Approval required by policy\. Approval: owner-review\./u);
  assert.match(markdown, /blocked: blocked - Blocked by policy\./u);
  assert.doesNotMatch(markdown, /allowed:.*Approval:/u);
  assert.doesNotMatch(markdown, /blocked:.*Approval:/u);

  const report = JSON.parse(formatJsonReport(result));
  assert.deepEqual(report.results.map(({ outcome, approval }) => ({ outcome, approval })), [
    { outcome: 'allowed', approval: null },
    { outcome: 'needs_approval', approval: 'owner-review' },
    { outcome: 'blocked', approval: null }
  ]);
});

test('cli exposes help and version metadata', () => {
  const help = spawnSync(process.execPath, ['src/cli.js', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /agent-action-simulator <actions\.json>/u);

  const version = spawnSync(process.execPath, ['src/cli.js', '--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^0\.1\.0\n$/u);
});

test('cli rejects malformed top-level plans with an actionable error', () => {
  const directory = mkdtempSync(join(tmpdir(), 'agent-action-simulator-'));

  try {
    const policyPath = join(directory, 'policy.json');
    writeFileSync(policyPath, JSON.stringify(policy));

    for (const [name, candidate, expected] of [
      ['null.json', null, /plan must be an object/iu],
      ['array.json', [], /plan must be an object/iu],
      ['missing-actions.json', {}, /plan actions must be an array/iu],
      ['non-array-actions.json', { actions: {} }, /plan actions must be an array/iu]
    ]) {
      const planPath = join(directory, name);
      writeFileSync(planPath, JSON.stringify(candidate));
      const result = spawnSync(
        process.execPath,
        ['src/cli.js', planPath, '--policy', policyPath, '--format', 'json'],
        { encoding: 'utf8' }
      );

      assert.equal(result.status, 1, name);
      assert.equal(result.stdout, '', name);
      assert.match(result.stderr, expected, name);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cli reports invalid action identity strings as malformed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'agent-action-simulator-'));
  const validAction = { id: 'send-1', type: 'message.send', target: 'gmail', fields: {} };

  try {
    const policyPath = join(directory, 'policy.json');
    writeFileSync(policyPath, JSON.stringify(policy));

    for (const [field, value] of [
      ['id', ''],
      ['id', '   '],
      ['id', ' send-1'],
      ['type', ''],
      ['type', '   '],
      ['type', 'message.send '],
      ['target', ''],
      ['target', '   '],
      ['target', ' gmail']
    ]) {
      const planPath = join(directory, `${field}-${JSON.stringify(value)}.json`);
      writeFileSync(planPath, JSON.stringify({ actions: [{ ...validAction, [field]: value }] }));
      const result = spawnSync(
        process.execPath,
        ['src/cli.js', planPath, '--policy', policyPath, '--format', 'json'],
        { encoding: 'utf8' }
      );

      assert.equal(result.status, 0, `${field}=${JSON.stringify(value)}`);
      const report = JSON.parse(result.stdout);
      assert.equal(report.summary.malformed, 1);
      assert.equal(report.results[0].reason, `Action ${field} must be a non-empty exact string`);
    }

    const validPath = join(directory, 'valid.json');
    writeFileSync(validPath, JSON.stringify({ actions: [validAction] }));
    const valid = spawnSync(
      process.execPath,
      ['src/cli.js', validPath, '--policy', policyPath, '--format', 'json'],
      { encoding: 'utf8' }
    );
    assert.equal(valid.status, 0);
    assert.equal(JSON.parse(valid.stdout).results[0].outcome, 'needs_approval');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
