# Duevia RWA

Duevia RWA is asset assurance infrastructure for tokenized private markets. It turns fragmented offchain evidence into a versioned, policy-enforceable assurance status that can be monitored and anchored on X Layer without publishing private commercial data.

## What the MVP demonstrates

- A trade-receivable case with evidence, entity, asset, policy, and monitoring controls.
- A working CSV asset-tape importer with duplicate-financing, delinquency, data-freshness, eligible-coverage, and debtor-concentration controls.
- A portfolio action queue that converts exceptions into transparent ALLOW, HOLD, or SUSPEND signals.
- Deterministic rule checks alongside schema-constrained AI investigation and an independent verifier.
- An assurance outcome: `VERIFIED`, `MANUAL REVIEW`, or `SUSPENDED`.
- An assurance level, policy ID, validity window, exception list, and exportable attestation.
- Wallet connection to X Layer Testnet (chain ID `1952`).
- A contract design in which an asset must have a valid Duevia attestation before an integrated pool or mint flow can accept it.
- A value-bearing receivables pool whose native-token deposits revert unless the referenced attestation is currently eligible.
- A recovery coordinator state machine for real servicing failures: suspend, reconstruct, review/restructure, successor-verify, and close.
- A chain-wide X Layer event scanner for Duevia protocol signatures, backed by persistent D1 observations and a five-minute Keeper.
- Live Cloudflare Workers AI for grounded incident analysis plus GDELT/Google News and independent endpoint observations.
- Versioned dual enforcement contracts requiring both an eligible attestation and a verified incident before accepting value.

## Product surfaces

- `/` — public product site.
- `/app` — interactive asset-assurance workspace.

The current browser demo accepts structured JSON so results stay deterministic and no raw evidence is uploaded to a third party. PDF, CSV, accounting, banking, and registry connectors are deliberate next-stage inputs rather than simulated live integrations.

The deployed Worker is no longer process-memory-only. `WATCHDOG_DB` stores scanner cursors, independent observations, incident evaluations, incidents, Recovery Capsules, AI investigations, execution approvals, and Keeper history. A Cron trigger scans X Layer every five minutes. A D1 lease prevents overlapping Keeper runs. `GET /api/watchdog` exposes redacted public audit metadata; evidence bodies, Capsule contents, snapshots, and execution payloads require administrator authorization. External watchdog writes require either the private administrator token or an allowlisted observer-wallet signature with replay protection.

The canonical adapter boundary is `duevia.servicer-feed/v1`: a signed snapshot envelope containing `poolId`, `capturedAt`, heartbeat state, asset rows, and payment rows. ERP, bank, and servicer adapters can normalize into this format while the same policy engine evaluates every source. See `lib/servicer-feed.mjs` for the validation contract.

## Onchain design

`contracts/DueviaAssetAssuranceRegistry.sol` stores only the evidence fingerprint, policy fingerprint, score, status, validity window, and attestor. It supports authorized attestors, status changes, expiry checks, and an `isEligible` query.

`contracts/DueviaEligibilityGuard.sol` shows how an issuance, pool, or market contract can require a current verified Duevia attestation before accepting an asset.

`contracts/DueviaReceivablesPool.sol` is the executable integration proof. Its payable `deposit` calls the guard before accepting testnet OKB, while withdrawals remain available to depositors. This demonstrates capital-flow enforcement rather than a UI-only eligibility signal.

`contracts/DueviaRecoveryCoordinator.sol` is the infrastructure handoff layer. It is deliberately separate from the asset registry: the registry answers "is this attestation eligible?" while the coordinator answers "which incident lifecycle is this pool in, who is the successor, and has the recovery capsule been approved?" The coordinator is designed for the failure patterns documented in Maple/Orthogonal, Centrifuge/Harbor Trade, and Goldfinch/Tugende and Stratos: stop new capital, preserve evidence, pursue recovery or restructuring, and require an authorized handoff before reopening.

The guard reverts with `AssetNotEligible` for suspended, expired, missing, or below-threshold attestations. This is the enforcement boundary: AI can propose a recovery state, but it cannot bypass the registry or pool path. Continuity recovery uses two linked attestations: first `SUSPENDED`, then a successor `VERIFIED` attestation whose `previousAttestation` points to the suspension record.

Set `NEXT_PUBLIC_DUEVIA_REGISTRY_ADDRESS` after deploying the registry to enable live attestation publishing in the DApp.

## Local development

Requirements: Node.js `22.13+` and a wallet that can switch to X Layer Testnet.

```bash
npm install
npm run dev
```

The public deployment uses Cloudflare Workers AI through the server-side `AI` binding: Llama 3.3 70B produces a JSON-Schema-constrained investigation and a separate Llama 3.1 8B model verifies evidence support. Malformed, uncited, or unverifiable output is persisted as `review-required` and cannot satisfy the execution policy.

### What recovery actually produces

An outage is not considered recovered when an AI summary is displayed. `POST /api/reconstruct` produces a review-ready `duevia.recovery-capsule/v1` artifact with per-asset reconstructed balances, independently matched payments and chain/public observations, evidence references, conflict codes, confidence, required approvals, and a deterministic `recoveryRoot`. The UI displays this capsule before a successor attestation is authorized. Any conflict forces `REVIEW` and requires successor plus governance approval; no AI output can silently turn uncertain balances into eligible collateral.

The `/api/agent` endpoint validates and bounds input and fails closed when either model is unavailable. Raw borrower data should not be sent to it; pass only the structured evidence needed for the investigation.

### Automatic suspension safety gates

The Keeper cannot broadcast a `SUSPENDED` transaction. It may only create an `AWAITING_MULTISIG` action after two consecutive independently corroborated outage runs, shadow mode is disabled, the project explicitly enables automatic suspension, a Coordinator is configured, the AI investigation and verifier both pass, and the Recovery Root is valid. Broadcasting remains disabled until the Coordinator, observer quorum, multisig, keeper authorization, and gas policy are deployed and verified.

Run the historical-pattern fault replays with `npm run bench:incidents`. The included Maple/Orthogonal-style and Tugende-style fixtures are synthetic scenarios derived from public failure patterns, not exact historical private ledgers or production accuracy claims.

## Autonomous infrastructure contracts

- `DueviaRecoveryCoordinator`: incident lifecycle and successor handoff.
- `DueviaContinuityGuard`: requires both Registry eligibility and Coordinator verification.
- `DueviaContinuityPool`: value-bearing reference pool protected by the dual guard.
- `DueviaObserverQuorum`: requires matching reports from at least two independent observers before executing a recovery action.
- `DueviaRecoveryMultisig`: transparent testnet recovery approvals; production should use a reviewed Safe-compatible multisig.

The Monitoring tab deploys Coordinator, Dual Guard, and Continuity Pool through the canonical CREATE2 factory using the connected X Layer wallet. Deployment still requires explicit wallet confirmation; no private key is stored by Duevia.

### Connecting a real servicer source

Use an API webhook, SFTP/S3 export, or ERP/bank connector that produces the canonical `duevia.servicer-feed/v1` envelope. The snapshot includes represented `tokenSupply` independently from asset balances so eligible-coverage checks cannot become true by construction. The server endpoint `POST /api/servicer-feed` is the trust boundary: it validates the schema, verifies an `hmac-sha256:` signature, enforces the heartbeat freshness window, runs the deterministic portfolio policy, and sends only aggregate, privacy-preserving context to the AI connector. The DApp can load a signed feed through the Continuity Agent. AI output is explanatory and proposes recovery actions; it cannot change the policy state or authorize an onchain operation.

Configure a server-only secret (never `NEXT_PUBLIC_*`):

```bash
SERVICER_FEED_HMAC_SECRET=<random-32-byte-secret>
```

For an adapter or integration test, sign a feed before posting it:

```bash
node scripts/sign-servicer-feed.mjs examples/servicer-feed.json /tmp/servicer-feed.signed.json "$SERVICER_FEED_HMAC_SECRET"
```

Then send the signed JSON to `POST /api/servicer-feed`. The endpoint rejects a duplicate `(poolId, capturedAt, signature)` during the process lifetime; production deployments should replace this cache with durable nonce/replay storage shared by all instances. Keep raw evidence encrypted in the servicer's system, rotate signing keys, and use a dedicated attestor or multisig for the resulting X Layer attestation.

## Testnet deployment

The DApp can deploy a personal `DueviaAssetAssuranceRegistry` from the **Deploy Duevia registry** action. Obtain test OKB from the [X Layer faucet](https://web3.okx.com/xlayer/faucet), switch the wallet to chain `1952`, and keep the resulting registry address in the browser session or set `NEXT_PUBLIC_DUEVIA_REGISTRY_ADDRESS` for a shared environment. Verify deployment and attestations on [OKLink X Layer Testnet](https://www.oklink.com/x-layer-testnet).

For production, use a separately reviewed deployment process and a multisig/role-managed attestor. The included registry is an MVP reference contract and has not undergone an independent security audit.

### Wallet identity

All DApp deployments and attestations use the wallet currently connected through `window.ethereum`. The application does not contain a project wallet address, private key, or fallback signer. Keep one browser wallet account selected for the testnet and later mainnet run; the Agentic Wallet CLI account is separate and is not used by the DApp.

X Layer Testnet configuration:

- Chain ID: `1952` (`0x7a0`)
- RPC: `https://testrpc.xlayer.tech`
- Explorer: `https://www.oklink.com/x-layer-testnet`

## Scope

Duevia checks submitted evidence and deterministic consistency controls. It is not a legal opinion, audit, credit rating, KYC provider, investment recommendation, or guarantee of asset ownership or repayment.
