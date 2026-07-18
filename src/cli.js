#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { simulatePlan } from './simulate.js';
import { formatJsonReport, formatMarkdownReport } from './report.js';

const usage = 'usage: agent-action-simulator <actions.json> --policy <policy.json> [--format json|markdown]';

async function main(argv) {
  const [planPath, ...rest] = argv;
  const flags = parseFlags(rest);

  if (planPath === '--help' || flags.help) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  if (planPath === '--version' || flags.version) {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  if (!planPath || !flags.policy) {
    throw new Error(usage);
  }

  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  const policy = JSON.parse(await readFile(flags.policy, 'utf8'));
  const simulation = simulatePlan(plan, policy);
  const format = flags.format ?? 'markdown';
  if (!['json', 'markdown'].includes(format)) {
    throw new Error('--format must be json or markdown');
  }
  process.stdout.write(format === 'json' ? formatJsonReport(simulation) : formatMarkdownReport(simulation));
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!['policy', 'format'].includes(key)) {
      throw new Error(`unknown option: ${arg}`);
    }
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`${arg} requires a value`);
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
