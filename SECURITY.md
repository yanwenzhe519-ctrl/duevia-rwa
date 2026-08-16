# Security policy

Duevia handles financial evidence and controls capital-flow eligibility. Do not report vulnerabilities in public issues.

Please report security issues privately to the project maintainers with reproduction steps, affected files, and impact. Never include private keys, seed phrases, API keys, borrower records, or unredacted production data.

The testnet contracts are an MVP reference implementation and are not a substitute for an independent audit before mainnet deployment. Production deployments must use role separation, key rotation, monitoring, a multisig attestor, and durable replay protection.

Automatic chain broadcasting is intentionally disabled. An execution can only enter the multisig queue after deterministic incident confirmation, valid event-sourced reconstruction, a valid Recovery Root, schema and citation validation, independent model verification, explicit project opt-in, and a configured Coordinator. Shadow projects can never queue transactions.

Public monitoring endpoints return identifiers, states, timestamps, roots, and transaction references only. Registered snapshots, raw observation payloads, Recovery Capsule bodies, and execution payloads require the server-side administrator bearer token. Rotate that token after operational use and never place it in browser storage or a `NEXT_PUBLIC_*` variable.
