# Contributing

Install Node.js 22.13+ and run:

```bash
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test
```

Keep policy decisions deterministic and covered by tests. Do not commit secrets, private keys, raw borrower data, or generated deployment state. Changes to contracts, attestation formats, or feed validation require updated tests and documentation.
