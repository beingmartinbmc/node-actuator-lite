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

Actuator endpoints can expose operational details. Treat `/actuator/env`, `/actuator/threaddump`, and `/actuator/heapdump` as privileged operator endpoints.

Recommended baseline for public services:

```ts
const actuator = new NodeActuator({
  health: { showDetails: 'never' },
  env: { enabled: false },
  threadDump: { enabled: false },
  heapDump: { enabled: false },
});
```

If you enable sensitive endpoints, protect them with authentication, network allowlists, private service networking, or reverse-proxy rules. Heap dumps can contain secrets and personally identifiable data, and generating them can temporarily block the Node.js event loop.
