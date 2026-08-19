# Duevia final X Layer Testnet deployment

This runbook applies to the current continuity contracts. Existing legacy Registry, Guard, and Pool addresses remain evidence of the earlier enforcement flow; they are not substitutes for this deployment.

## Preconditions

- Connected network is X Layer Testnet, chain ID `1952`.
- Connected project wallet is `0x05667de34ad47bafe8a8b976c19809cadf7719d2`.
- Registry, Coordinator, Guard, Pool, Quorum, and Multisig bytecode is generated from the same Git commit.
- At least three independent governance addresses are available for a 2-of-3 multisig.
- At least three independent observer addresses are available for a 2-of-3 observer quorum.
- No private key, seed phrase, bearer token, or raw borrower record is entered into the DApp.

## Deployment order

1. Deploy a current Registry whose owner is the connected project wallet.
2. Deploy `DueviaRecoveryCoordinator` with the project wallet as bootstrap owner.
3. Deploy `DueviaContinuityGuard` with Registry, Coordinator, and minimum score `80`.
4. Deploy `DueviaContinuityPool` with the Dual Guard address.
5. Deploy `DueviaRecoveryMultisig` with independent signers and threshold `2` or greater.
6. Deploy `DueviaObserverQuorum` with independent observers and threshold `2` or greater.
7. Start two-step ownership transfers for both Registry and Coordinator to the multisig.
8. Through the multisig, accept ownership of both contracts and authorize only the required Registry attestor and Coordinator Keeper/quorum operator.
9. Confirm that the bootstrap wallet is no longer an authorized Registry attestor and no longer retains implicit Coordinator operator rights.

## Required rehearsal

1. Register a labelled shadow project with automatic suspension disabled.
2. Produce two independently corroborated outage evaluations in consecutive Keeper runs.
3. Confirm a persistent Incident, event-sourced Capsule, valid Recovery Root, structured AI investigation, and verifier decision.
4. Approve an exact `openIncident` calldata payload through the observer quorum. The approved hash must bind incident, epoch, report, target, and calldata.
5. Submit the multisig-approved transaction and verify the Coordinator is `Suspended`.
6. Prove the Continuity Pool rejects a deposit while the incident is not `Verified`.
7. Record recovery, propose a successor, and verify the successor through governance.
8. Prove the same Pool accepts a minimal deposit only after both attestation and incident are eligible.
9. Record every address, transaction hash, block number, Git commit, and Recovery Root in the public evidence page.

## Verified RWA takeover deployment

The following X Layer Testnet records were verified from RPC receipts and CREATE2 calldata. Each init code matches exactly one generated artifact; the computed CREATE2 address had no code in the preceding block and the recorded runtime bytecode in the deployment block.

| Artifact | Address | Deployment transaction | Block |
| --- | --- | --- | --- |
| `DueviaRwaRegistry` | `0xaeCA0FEe07Debea353eB0728EdD1e9D917a94297` | `0x0e0e641563022e0e954336433bc154dda531f54346d38ebd8ebc37da002dcc52` | `38705557` |
| `DueviaCheckpointRegistry` | `0x9fB26d32750f387c75F9577135a6E274730759D2` | `0xa1fdfeebe9ecd171830e608aa1e28b1431c282b50ce14361fbc7369cfb63708b` | `38705571` |
| `DueviaIncidentStateMachine` | `0xBb9dfb771248594A365cabe0114cf362d68279a7` | `0x39cab15d8fbc19900de93a85bde2d1308a72cea93dcc9960b27f3e175204cbe7` | `38705583` |
| `DueviaRwaVault` | `0x00344E2e44AFf7cF7429738E99Fd056a099A077F` | `0xd2e6125197c1c1e918903e3b2143d23c955f1784c1d90645152916791a934df2` | `38705607` |
| `DueviaRecoveryAdapterV2` | `0x3d901880b9416ad7b00569C7b0B67b8e8008d6Af` | `0x10265dc4b640926ec50a28b8374099a8ae02ee592bb7e464d5b2d32dfc36b8bb` | `38705619` |

Transaction `0x7ca1b72c541b4179dae61d793a423d8adc7103c6c99f54b0c900360b7ecebf71` succeeded in block `38705686`. Its account-abstraction inner call targets the RWA Vault and calls `grantRole`. The receipt emits `RoleGranted` for role `0xdbeb657137b1822b3d5418bea6fd641226d964b4c3871ef23546db2622258871` (`keccak256("ADAPTER_ROLE")`) to Recovery Adapter V2.

## Redemption replay-fixed Vault replacement

The replay fix is a new immutable deployment; it cannot be applied to the existing Vault address. Because `DueviaRecoveryAdapterV2` stores its Vault address immutably, deploy both replacement contracts before changing any project or D1 address:

1. Open the DApp deployment console on X Layer Testnet and use `Deploy hardened Vault`. The constructor admin is the RPC-verified Recovery Multisig, and the CREATE2 label is `rwa-vault-hardened-v2`.
2. Verify the receipt, actual CREATE2 address, deployment block, runtime bytecode, constructor admin, and the redemption settlement replay regression against the generated artifact.
3. Use `Deploy hardened Recovery Adapter V2`. It is constructed with the same Recovery Multisig and the new Vault address, using the distinct label `recovery-adapter-v2-hardened`.
4. Verify the Adapter `vault()` call equals the new Vault and verify its runtime bytecode and deployment receipt.
5. Use the two-step Recovery Multisig controls to grant `ADAPTER_ROLE` on the new Vault to the new Adapter. Verify the `RoleGranted` receipt and an `eth_call` to `hasRole`.
6. Keep the existing five takeover addresses and historical evidence unchanged. Do not overwrite `rwaVault`, `recoveryAdapterV2`, `DUEVIA-RCV-018`, or D1 until an independent migration approval records the replacement addresses and rollback plan.

The browser stores replacement evidence separately under `hardenedReplacement`; this is intentionally not counted as the verified legacy takeover `5/5` status.

The hardened replacement cutover is recorded in D1 migration `0012_hardened_vault_cutover.sql`. It changes only the active `DUEVIA-RCV-018` Vault/Adapter pointers; the legacy deployment evidence and historical checkpoint finality metadata remain unchanged. Rollback is the inverse pointer update to the verified legacy addresses, subject to governance approval.

The public AI health endpoint must continue to report `DEGRADED` / `review-required` when validation fails. The historical testnet record failed because `facts must contain at least one cited claim`; the verifier prompt also now explicitly treats `requiresApproval: true` as an approval gate rather than an absent approval. A live post-fix diagnostic returned `validation.valid = true` and `model-grounded`. Keeper retries a failed investigation for the same incident and recovery root after a 15-minute cooldown, so a corrected model result can replace a stale failed record without burning inference quota every five minutes. Persisted health becomes `READY` only after that retry passes both deterministic and independent verification. These are evidence-quality controls, not wallet errors, and no validated candidate is fabricated.

## Mainnet prohibition

Do not deploy to mainnet or enable automatic broadcasting until an independent contract audit, key-management review, incident-response exercise, real data adapter pilot, gas policy, and rollback plan have been completed.
# Audit hardening gate (2026-08-20)

Before any testnet write, verify the five takeover contracts and their roles from `/api/evidence` plus read-only RPC. The current deployment is TAKEOVER runtime but bootstrap-controlled; do not describe it as Recovery Multisig-governed. Keep AI `DEGRADED` / `review-required` and explain `NO VALIDATED CANDIDATE` as insufficient evidence, not a wallet failure. Do not rewrite historical `UNKNOWN` finality statuses.
