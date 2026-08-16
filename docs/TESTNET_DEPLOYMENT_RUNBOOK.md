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
7. Through the multisig, accept Coordinator ownership and authorize only the required Keeper/quorum operator.
8. Confirm that the bootstrap owner no longer retains implicit operator rights after ownership transfer.

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

## Mainnet prohibition

Do not deploy to mainnet or enable automatic broadcasting until an independent contract audit, key-management review, incident-response exercise, real data adapter pilot, gas policy, and rollback plan have been completed.
