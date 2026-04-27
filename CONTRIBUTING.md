# Contributing

Thanks for helping improve `node-actuator-lite`.

## Development Setup

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:package
```

## Pull Request Checklist

- Keep changes focused on one behavior or documentation improvement.
- Add or update tests for public API changes.
- Update `README.md`, `USAGE.md`, or `CHANGELOG.md` when behavior changes.
- Avoid adding runtime dependencies unless they are essential for actuator behavior.
- Treat `/env`, `/threaddump`, and `/heapdump` changes as security-sensitive.

## Release Checks

Before publishing, run:

```bash
npm ci
npm run typecheck
npm test -- --coverage
npm run build
npm run test:package
npm run pack:dry-run
```

The package should stay small, framework-agnostic, and safe to deploy behind standard production controls.
