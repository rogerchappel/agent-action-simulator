import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
