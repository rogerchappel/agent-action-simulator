import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'agent-action-simulator-package-smoke-'));

try {
  const output = execFileSync('npm', ['pack', '--json', '--pack-destination', temporaryDirectory], {
    encoding: 'utf8'
  });
  const [packument] = JSON.parse(output);
  const files = new Set(packument.files.map((file) => file.path));

  const required = [
    'package.json',
    'README.md',
    'LICENSE',
    'SECURITY.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'SKILL.md',
    'scripts/validate-release-readiness.mjs',
    'src/cli.js',
    'src/index.js',
    'src/simulate.js',
    'src/report.js',
    'fixtures/actions.json',
    'fixtures/policy.json',
    'docs/RELEASE_CANDIDATE.md'
  ];

  const missing = required.filter((file) => !files.has(file));
  if (missing.length > 0) {
    throw new Error(`Package smoke missing expected files: ${missing.join(', ')}`);
  }

  const consumerDirectory = join(temporaryDirectory, 'consumer');
  await mkdir(consumerDirectory);
  await writeFile(join(consumerDirectory, 'package.json'), '{"private":true,"type":"module"}\n');

  const tarballPath = join(temporaryDirectory, packument.filename);
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath], {
    cwd: consumerDirectory,
    stdio: 'pipe'
  });

  const executable = join(consumerDirectory, 'node_modules', '.bin', 'agent-action-simulator');
  const help = execFileSync(executable, ['--help'], { cwd: consumerDirectory, encoding: 'utf8' });
  if (!help.includes('usage: agent-action-simulator')) {
    throw new Error('Installed CLI help did not contain the expected usage');
  }

  const version = execFileSync(executable, ['--version'], { cwd: consumerDirectory, encoding: 'utf8' }).trim();
  if (version !== packument.version) {
    throw new Error(`Installed CLI version mismatch: expected ${packument.version}, received ${version}`);
  }

  const publicExports = [
    'classifyAction',
    'simulatePlan',
    'validatePlan',
    'validatePolicy',
    'formatJsonReport',
    'formatMarkdownReport'
  ];
  const importCheck = `
    const module = await import('agent-action-simulator');
    const missing = ${JSON.stringify(publicExports)}.filter((name) => typeof module[name] !== 'function');
    if (missing.length > 0) throw new Error('Missing public exports: ' + missing.join(', '));
  `;
  execFileSync(process.execPath, ['--input-type=module', '--eval', importCheck], {
    cwd: consumerDirectory,
    stdio: 'pipe'
  });

  console.log(
    `Package consumer smoke ok: ${packument.filename} (${packument.files.length} files, CLI and ${publicExports.length} exports)`
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
