# Duevia security review status

This is a maintainer threat review, not an independent audit.

## Controls implemented

- Deterministic policy and event-sourced balance reconstruction remain authoritative; AI cannot change balances or bypass approval gates.
- AI output uses a strict schema, evidence citations, deterministic validation, and a second model verifier. Failure is review-required.
- Ordinary outage suspension requires independent sources and consecutive Keeper runs.
- Registry and Coordinator use two-step ownership transfer and revoke bootstrap privileges on acceptance.
- Recovery actions use a minimum 2-of-3 multisig; observer actions bind incident, epoch, report, target, and calldata.
- Governance signers and observer addresses are non-overlapping control planes in the deployment console.
- Signed observer responses are pool-bound, fresh, allowlisted, replay-identifiable, and size-limited.
- Servicer-feed replay receipts are durable in D1 and store only sanitized receipt metadata.
- Public endpoints redact snapshots, Capsule bodies, observation payloads, and execution calldata.
- Automatic transaction broadcasting remains disabled.

## Open before mainnet

- Independent Solidity audit and remediation report.
- Safe-compatible production multisig instead of the reference testnet multisig.
- Hardware-backed signer custody, recovery, rotation, and quorum-loss exercise.
- Independent observer organizations and a proven secondary Keeper operator.
- Real servicer/bank/onchain adapter pilot with measured availability and reconstruction error.
- Economic caps, rate limits, incident liability allocation, and legal review.
- Full mainnet deployment rehearsal and rollback exercise.

No document in this repository should be represented as third-party audit assurance.
