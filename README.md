# Duevia RWA

Duevia RWA is asset assurance infrastructure for tokenized private markets. It turns fragmented offchain evidence into a versioned, policy-enforceable assurance status that can be monitored and anchored on X Layer without publishing private commercial data.

## What the MVP demonstrates

- A trade-receivable case with evidence, entity, asset, policy, and monitoring controls.
- Deterministic rule checks alongside an AI-ready evidence intake layer.
- An assurance outcome: `VERIFIED`, `MANUAL REVIEW`, or `SUSPENDED`.
- An assurance level, policy ID, validity window, exception list, and exportable attestation.
- Wallet connection to X Layer Testnet (chain ID `1952`).
- A contract design in which an asset must have a valid Duevia attestation before an integrated pool or mint flow can accept it.

## Product surfaces

- `/` — public product site.
- `/app` — interactive asset-assurance workspace.

The current browser demo accepts structured JSON so results stay deterministic and no raw evidence is uploaded to a third party. PDF, CSV, accounting, banking, and registry connectors are deliberate next-stage inputs rather than simulated live integrations.

## Onchain design

`contracts/DueviaAssetAssuranceRegistry.sol` stores only the evidence fingerprint, policy fingerprint, score, status, validity window, and attestor. It supports authorized attestors, status changes, expiry checks, and an `isEligible` query.

`contracts/DueviaEligibilityGuard.sol` shows how an issuance, pool, or market contract can require a current verified Duevia attestation before accepting an asset.

Set `NEXT_PUBLIC_DUEVIA_REGISTRY_ADDRESS` after deploying the registry to enable live attestation publishing in the DApp.

X Layer Testnet configuration:

- Chain ID: `1952` (`0x7a0`)
- RPC: `https://testrpc.xlayer.tech`
- Explorer: `https://www.oklink.com/x-layer-testnet`

## Scope

Duevia checks submitted evidence and deterministic consistency controls. It is not a legal opinion, audit, credit rating, KYC provider, investment recommendation, or guarantee of asset ownership or repayment.
