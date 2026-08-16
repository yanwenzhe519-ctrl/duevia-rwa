# Duevia architecture

Duevia separates evidence ingestion, deterministic policy, AI explanation, and onchain enforcement.

1. Duevia monitors discoverable X Layer RWA pools and public/onchain signals. A servicer adapter may also emit a signed `duevia.servicer-feed/v1` snapshot; it is a baseline, not a dependency after outage.
2. `POST /api/servicer-feed` verifies the schema, HMAC signature, freshness, and replay key.
3. The portfolio engine computes the authoritative `VERIFIED`, `MANUAL REVIEW`, or `SUSPENDED` state.
4. Only aggregate, privacy-preserving evidence is sent to the OpenAI-compatible model through `/api/agent`.
5. The reconstruction engine emits a portable `duevia.recovery-capsule/v1`: per-asset reconstructed balances, independently observed payments/events, evidence references, conflicts, confidence, required approvals, and a deterministic `recoveryRoot`.
6. An authorized attestor publishes the status and recovery root to the Duevia registry on X Layer.
7. `DueviaEligibilityGuard` reads `isEligible()` and reverts unsafe pool or issuance operations.
8. `DueviaReceivablesPool` proves the enforcement boundary with payable testnet OKB deposits: suspended attestations revert, verified attestations accept value.

`DueviaRecoveryCoordinator` adds the failure-management layer missing from ordinary attestation registries. It models `SUSPENDED -> RECONSTRUCTED/REVIEW/RESTRUCTURING -> VERIFIED -> CLOSED`, records the recovery capsule root, names an authorized successor, and exposes `isCapitalFlowAllowed(incidentId)`. This is based on recurring RWA incident mechanisms: stop new lending, preserve the last trusted state, run independent recovery/collection, require governance or successor approval, and only then restore eligibility.

Continuity is a two-phase state transition. An outage first publishes `SUSPENDED`. A successor may later publish a new `VERIFIED` attestation linked through `previousAttestation`. The interface does not display `RESTORED` until the second transaction has been submitted successfully.

The model never signs transactions, changes policy thresholds, or bypasses the guard. Raw borrower and payment records remain offchain.
