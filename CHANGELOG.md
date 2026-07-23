# Changelog

## 0.1.0

- Initial release candidate for local connector action simulation.
- Includes CLI help and version smoke coverage, fixture-backed policy checks, and npm package smoke verification.
- Adds release-readiness validation for package metadata, support docs, CI
  presence, and npm allowlist coverage.
- Resolves policy rules by selector specificity instead of input order, blocks
  ambiguous equal-specificity matches, and rejects malformed policy rules.
