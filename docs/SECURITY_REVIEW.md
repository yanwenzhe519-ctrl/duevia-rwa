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
- The latest shadow-flight AI investigation passed deterministic and independent verification; project-level AI status remains evidence-scoped and cannot be generalized across projects.
- Read-only RPC verifies Recovery Multisig admin/operator roles on the takeover contracts and false bootstrap role checks. Business registration evidence is tracked separately from runtime role evidence.

## Open before mainnet

- Independent Solidity audit and remediation report.
- Safe-compatible production multisig instead of the reference testnet multisig.
- Hardware-backed signer custody, recovery, rotation, and quorum-loss exercise.
- Independent observer organizations and a proven secondary Keeper operator.
- Real servicer/bank/onchain adapter pilot with measured availability and reconstruction error.
- Economic caps, rate limits, incident liability allocation, and legal review.
- Full mainnet deployment rehearsal and rollback exercise.
- Independently verify project registration and project-specific AI evidence before treating any runtime as mainnet-ready.

No document in this repository should be represented as third-party audit assurance. Testnet evidence is separated from mainnet readiness and from project-specific AI validation.
# 2026-08-20 testnet hardening gate

- X Layer Testnet chain ID is `1952`; the five takeover addresses must be read from verified deployment evidence, never inferred from transaction order.
- Recovery Multisig role ownership and bootstrap-role revocation are RPC-verified for the takeover runtime; business registration remains a separate evidence layer.
- Workers AI has a passing shadow-flight investigation. A project is only `model-grounded` after its own evidence capsule passes deterministic and independent verification; otherwise it remains `review-required`.
- Historical checkpoints with `UNKNOWN` finality metadata must remain unchanged. New checkpoints require confirmation depth and `rpcUrl`.
- Redemption settlement must bind request ID to account and amount and consume the request exactly once. Source hardening is not a deployed-chain upgrade until separately approved.
