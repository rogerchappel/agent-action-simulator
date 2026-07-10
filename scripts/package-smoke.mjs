import { execFileSync } from 'node:child_process';

const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
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
  'src/cli.js',
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

console.log(`Package smoke ok: ${packument.name}-${packument.version}.tgz (${packument.files.length} files)`);
