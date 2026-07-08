import test from 'node:test';
import assert from 'node:assert/strict';
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

test('renders markdown reviewer report', () => {
  const result = simulatePlan({
    actions: [
      { id: 'a1', type: 'crm.note.create', target: 'hubspot', fields: { body: 'ok' } }
    ]
  }, policy);

  assert.match(formatMarkdownReport(result), /# Agent Action Simulation/u);
  assert.match(formatMarkdownReport(result), /a1: allowed/u);
});
