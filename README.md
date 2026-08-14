# X-Ray RWA

AI-powered verification and risk intelligence for real-world assets. X-Ray RWA turns fragmented offchain evidence into structured, explainable findings and tamper-evident proof on X Layer.

## Product surfaces

- `/` — English marketing site explaining the verification infrastructure, five modules, users, and business model.
- `/app` — DApp workspace for loading a structured evidence package, running all five modules, reviewing findings, generating a report fingerprint, and connecting an EVM wallet to X Layer Testnet.

## Five modules

1. Document Intelligence — classify evidence, extract material fields, and reconcile amounts.
2. Entity & Counterparty — review issuer, KYB, sanctions, and payment-account signals.
3. Asset & Cash-flow — compare reported value, represented supply, payment terms, and delivery dates.
4. Explainable Risk — produce a comparable score with reason codes and review actions.
5. Monitoring & Proof — track freshness, preserve report versions, and anchor fingerprints on X Layer.

The current MVP runs the evidence model locally so that the demo remains deterministic and does not expose private documents. The next integration point is a provider-backed OCR/LLM extraction service; the rule layer remains deterministic and auditable.

## Onchain design

`contracts/XRayProofRegistry.sol` stores only the report ID, evidence fingerprint, score, status, issuer, and version link. Raw files never enter the contract. The contract is intentionally small and supports a revocable versioned proof trail.

X Layer Testnet configuration:

- Chain ID: `1952` (`0x7A0`)
- RPC: `https://xlayertestrpc.okx.com/terigon`
- Explorer: `https://www.okx.com/web3/explorer/xlayer-test`

Set `NEXT_PUBLIC_XRAY_REGISTRY_ADDRESS` after deploying the registry to enable the final anchor action in the DApp.

## Local development

```bash
npm install
npm run dev
npm run build
npm test
```

## Scope and disclaimer

X-Ray RWA checks submitted evidence and data consistency. It is not a legal opinion, an audit, investment advice, a KYC provider, or a guarantee of asset ownership or repayment.
