# Security Policy

## Supported Versions

Security fixes are provided for the latest published major version of `node-actuator-lite`.

## Reporting A Vulnerability

Please report suspected vulnerabilities privately by emailing the maintainer listed in `package.json` or by opening a GitHub security advisory for this repository. Do not disclose sensitive findings in a public issue before a fix is available.

Include:

- Affected version
- Reproduction steps
- Impact and affected endpoint, if known
- Suggested mitigation, if available

## Production Guidance

Actuator endpoints can expose operational details. Treat `/actuator/env`, `/actuator/threaddump`, `/actuator/heapdump`, and `/actuator/loggers` as privileged operator endpoints.

Recommended baseline for public services — the `preset: 'production'` option disables all of the endpoints above (plus `/dashboard`) and hides health details in one line:

```ts
const actuator = new NodeActuator({
  preset: 'production',
  auth: checkBearerToken, // still required — preset does not add authentication
});
```

`preset` must be set explicitly; it is never inferred from `NODE_ENV`. Equivalently, endpoints can be disabled individually:

```ts
const actuator = new NodeActuator({
  health: { showDetails: 'never' },
  env: { enabled: false },
  threadDump: { enabled: false },
  heapDump: { enabled: false },
  loggers: { enabled: false },
});
```

If you enable sensitive endpoints, protect them with authentication, network allowlists, private service networking, or reverse-proxy rules. Heap dumps can contain secrets and personally identifiable data, and generating them can temporarily block the Node.js event loop. The loggers endpoint lets callers change log verbosity at runtime — treat it like any other administrative control.
