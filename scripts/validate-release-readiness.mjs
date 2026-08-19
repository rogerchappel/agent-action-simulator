import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const readme = readFileSync('README.md', 'utf8');
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const failures = [];

function requireField(condition, message) {
  if (!condition) failures.push(message);
}

requireField(pkg.name === 'agent-action-simulator', 'package name must remain agent-action-simulator');
requireField(pkg.version === '0.1.0', 'release candidate version must be 0.1.0');
requireField(pkg.license === 'MIT', 'package must declare the MIT license');
requireField(pkg.engines?.node === '>=20', 'Node engine must document the node:test runtime baseline');
requireField(pkg.repository?.url === 'git+https://github.com/rogerchappel/agent-action-simulator.git', 'repository metadata must point at GitHub');
requireField(pkg.bugs?.url === 'https://github.com/rogerchappel/agent-action-simulator/issues', 'bugs URL must point at GitHub issues');
requireField(pkg.homepage === 'https://github.com/rogerchappel/agent-action-simulator#readme', 'homepage must point at the README');
requireField(pkg.bin?.['agent-action-simulator'] === './src/cli.js', 'CLI bin must point at ./src/cli.js');
requireField(Array.isArray(pkg.files), 'package files allowlist is required');
requireField(/node-version:\s*\[20, 26\]/.test(ciWorkflow), 'CI must test the minimum and current maintained Node releases');
requireField(/node-version:\s*\$\{\{ matrix\.node-version \}\}/.test(ciWorkflow), 'CI setup-node must use the runtime matrix');
requireField(/run:\s*npm run release:check/.test(ciWorkflow), 'CI matrix jobs must run the complete release check');
requireField(readme.includes('not published to the npm registry yet'), 'README must distinguish source usage from future registry installation');
requireField(readme.includes('Node 20 and Node 26 CI matrix'), 'README must document the verified runtime matrix');

for (const file of [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'SKILL.md',
  'docs/RELEASE_CANDIDATE.md',
  'fixtures/actions.json',
  'fixtures/policy.json',
  '.github/workflows/ci.yml'
]) {
  requireField(existsSync(file), `${file} must be present for release review`);
}

for (const entry of ['src', 'scripts', 'docs', 'fixtures', 'SKILL.md', 'README.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md', 'CONTRIBUTING.md']) {
  requireField(pkg.files.includes(entry), `package files allowlist must include ${entry}`);
}

if (failures.length) {
  console.error(`release readiness failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('release readiness ok');
