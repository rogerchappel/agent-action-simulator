import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { simulatePlan } from '../src/simulate.js';
import { formatMarkdownReport } from '../src/report.js';

const policy = {
  rules: [
    { type: 'crm.note.create', target: 'hubspot', outcome: 'allowed' },
    { type: 'crm.deal.update', target: 'hubspot', outcome: 'needs_approval', approval: 'sales-review' },
    { type: 'message.send', target: '*', outcome: 'needs_approval', blockedFields: ['bcc'] }
  ]
};

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
  assert.match(result.results[4].reason, /missing string type/u);
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
    [{ rules: [{ type: 'message.send', target: 'gmail', outcome: 'needs_approval', approval: '  ' }] }, /non-empty approval/iu]
  ];

  for (const [candidate, expected] of malformedPolicies) {
    assert.throws(() => simulatePlan(plan, candidate), expected);
  }
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

test('cli exposes help and version metadata', () => {
  const help = spawnSync(process.execPath, ['src/cli.js', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /agent-action-simulator <actions\.json>/u);

  const version = spawnSync(process.execPath, ['src/cli.js', '--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^0\.1\.0\n$/u);
});
