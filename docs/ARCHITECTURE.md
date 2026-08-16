# Duevia architecture

Duevia separates evidence ingestion, deterministic policy, AI explanation, and onchain enforcement.

The live runtime has three independent planes:

1. **Observation plane**: a bounded X Layer JSON-RPC scanner discovers Duevia protocol events across all emitting addresses; registered project endpoints and public reporting provide independent offchain signals.
2. **Recovery plane**: D1 stores observations, scan cursors, evaluations, incidents, immutable Capsule versions, AI investigations, and execution approvals. A leased five-minute Keeper advances the scan. The deterministic Watchdog decides incident state and the event-sourced reconstruction engine computes balances. Workers AI investigates the resulting evidence; a separate model verifies its citations.
3. **Enforcement plane**: Registry + Recovery Coordinator + Continuity Guard + Continuity Pool require both asset eligibility and a verified incident before accepting capital.

1. Duevia monitors discoverable X Layer RWA pools and public/onchain signals. A servicer adapter may also emit a signed `duevia.servicer-feed/v1` snapshot; it is a baseline, not a dependency after outage.
2. `POST /api/servicer-feed` verifies the schema, HMAC signature, freshness, and replay key.
3. The portfolio engine computes the authoritative `VERIFIED`, `MANUAL REVIEW`, or `SUSPENDED` state.
4. Only bounded, structured evidence is sent to Workers AI through `/api/agent`. The primary output must satisfy `duevia.ai-investigation/v1`, cite known evidence IDs, and pass a separate verifier.
5. The reconstruction engine emits a portable `duevia.recovery-capsule/v1`: per-asset reconstructed balances, independently observed payments/events, evidence references, conflicts, confidence, required approvals, and a deterministic `recoveryRoot`.
6. An authorized attestor publishes the status and recovery root to the Duevia registry on X Layer.
7. `DueviaEligibilityGuard` reads `isEligible()` and reverts unsafe pool or issuance operations.
8. `DueviaReceivablesPool` proves the enforcement boundary with payable testnet OKB deposits: suspended attestations revert, verified attestations accept value.

`DueviaRecoveryCoordinator` adds the failure-management layer missing from ordinary attestation registries. It models `SUSPENDED -> RECONSTRUCTED/REVIEW/RESTRUCTURING -> VERIFIED -> CLOSED`, records the recovery capsule root, names an authorized successor, and exposes `isCapitalFlowAllowed(incidentId)`. This is based on recurring RWA incident mechanisms: stop new lending, preserve the last trusted state, run independent recovery/collection, require governance or successor approval, and only then restore eligibility.

`DueviaObserverQuorum` prevents one monitoring process from unilaterally executing an incident action. `DueviaRecoveryMultisig` separates operational automation from exceptional recovery authority. The Keeper never possesses the power to declare legal ownership, absorb a loss, or approve restructuring terms.

Continuity is a two-phase state transition. An outage first publishes `SUSPENDED`. A successor may later publish a new `VERIFIED` attestation linked through `previousAttestation`. The interface does not display `RESTORED` until the second transaction has been submitted successfully.

The model never computes authoritative balances, signs transactions, changes policy thresholds, or bypasses the guard. Raw borrower and payment records remain offchain. Public APIs expose audit metadata only; full evidence, Capsule, and execution payloads require administrator authorization.

Ordinary outages require at least two independent sources and two consecutive Keeper runs. A single endpoint or news source cannot suspend a pool. Invalid signed evidence is treated as critical but still remains in shadow mode unless the project has deliberately completed every execution gate. Automatic broadcasting is currently disabled.
