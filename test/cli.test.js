import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cli = new URL('../src/cli.js', import.meta.url);
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname;

async function run(args) {
  try {
    return await execFileAsync(process.execPath, [cli.pathname, ...args]);
  } catch (error) {
    return error;
  }
}

test('rejects unknown options instead of silently ignoring them', async () => {
  const result = await run([
    fixture('actions.json'),
    '--policy', fixture('policy.json'),
    '--fromat', 'json'
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /unknown option: --fromat/u);
});

test('rejects unsupported output formats', async () => {
  const result = await run([
    fixture('actions.json'),
    '--policy', fixture('policy.json'),
    '--format', 'yaml'
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /--format must be json or markdown/u);
});

test('rejects options with missing values', async () => {
  const result = await run([fixture('actions.json'), '--policy']);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /--policy requires a value/u);
});

test('applies an exact blocking rule before an earlier wildcard rule', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-action-simulator-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const planPath = join(directory, 'actions.json');
  const policyPath = join(directory, 'policy.json');
  await writeFile(planPath, JSON.stringify({
    actions: [{ id: 'send-1', type: 'message.send', target: 'gmail', fields: {} }]
  }));
  await writeFile(policyPath, JSON.stringify({
    rules: [
      { type: '*', target: '*', outcome: 'allowed' },
      { type: 'message.send', target: 'gmail', outcome: 'blocked' }
    ]
  }));

  const result = await run([planPath, '--policy', policyPath, '--format', 'json']);

  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).results[0].outcome, 'blocked');
});

test('rejects malformed policy files', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-action-simulator-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const policyPath = join(directory, 'policy.json');
  await writeFile(policyPath, JSON.stringify({
    rules: [{ type: 'message.*', target: '*', outcome: 'allowed' }]
  }));

  const result = await run([
    fixture('actions.json'),
    '--policy', policyPath,
    '--format', 'json'
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /wildcard must be the entire value/iu);
});
