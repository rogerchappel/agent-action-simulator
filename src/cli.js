#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { simulatePlan } from './simulate.js';
import { formatJsonReport, formatMarkdownReport } from './report.js';

async function main(argv) {
  const [planPath, ...rest] = argv;
  const flags = parseFlags(rest);

  if (!planPath || !flags.policy) {
    throw new Error('usage: agent-action-simulator <actions.json> --policy <policy.json> [--format json|markdown]');
  }

  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  const policy = JSON.parse(await readFile(flags.policy, 'utf8'));
  const simulation = simulatePlan(plan, policy);
  const format = flags.format ?? 'markdown';
  process.stdout.write(format === 'json' ? formatJsonReport(simulation) : formatMarkdownReport(simulation));
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
