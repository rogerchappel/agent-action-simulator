# Contributing

Keep changes local-first and fixture-backed. This package must not call live connector APIs, load credentials, or mutate external systems during tests or smoke checks.

Before opening a PR, run:

```sh
npm run release:check
```

When package contents change, update `scripts/package-smoke.mjs` so the npm tarball still includes the CLI, fixtures, docs, security policy, changelog, contribution guide, skill instructions, README, and license.
