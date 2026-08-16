# X Layer AI Season submission evidence

## Product

- Project: Duevia Continuity Agent
- Category: AI + RWA
- Public DApp: `https://duevia-rwa.cardrevive-agent.workers.dev/app`
- Network: X Layer Testnet, chain ID `1952`

## Why this is infrastructure

Duevia is not a dashboard that asks a failed servicer for another upload. It is an X Layer continuity layer: independent observations trigger a deterministic incident state, an event-sourced engine produces `duevia.recovery-capsule/v1`, and schema-constrained AI investigates and cites that evidence under an independent verifier. A successor can only reopen capital flows after the recovery root and authorization are recorded. `DueviaRecoveryCoordinator` models `SUSPENDED`, `RECONSTRUCTED`, `REVIEW`, `RESTRUCTURING`, `VERIFIED`, and `CLOSED` so a default or servicing outage has an explicit onchain lifecycle.

Live infrastructure evidence:

- Persistent D1 database: `duevia-watchdog`
- Keeper schedule: every five minutes
- X Layer scanner: chain ID `1952`, real `eth_blockNumber` and chunked `eth_getLogs`
- Scanner replay proof: the existing 1 wei Pool deposit is independently decoded from transaction `0xe525...f9a77`
- Live model: Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- Public intelligence adapters: GDELT DOC 2.0 with Google News RSS fallback
- External observer writes: allowlist, wallet signature, and nonce replay protection
- False-positive controls: multi-source threshold, two consecutive ordinary outage runs, shadow mode, and fail-closed AI verification
- Replay benchmark: `npm run bench:incidents` covers Maple/Orthogonal-style and Tugende-style synthetic incidents

## Existing onchain evidence

- Registry: `0xaa747b92496f6c5f01b9a32d8108da797c85a8c2`
- Eligibility Guard: `0xc7b1ed1d1cd7b1cc485ad9f45b329c68c2a7243a`
- Receivables Pool: `0xe68b0c11cad7f756a536391ff3632e8956bbcc95`
- SUSPENDED transaction: `0x653d0fb6ae23d2b6425444cab13d551a48b6e44a27e9772ef0a9c2c29099ba82`
- VERIFIED transaction: `0x28765800663e1dfa48ecbb9a09ead38673a0c9316e0e8faefc2862d66e1bfc55`
- Guard allow transaction: `0x150e19e69a22b8246d21bb510e3b491fb437c7d55f5c53b169bee6a5954815cb`
- Guard deployment transaction: `0x19ab65ad6cadb767224df3c98a8555f90a892a2239e46c3fdaf28b2375c3a27d`
- VERIFIED Pool deposit (1 wei): `0xe525d1b7fa4dc315a0b014c6f5e1d0e8a2fd66ce2bff0b346e37047c403f9a77`

## Final evidence still requiring an authorized user action

- Deploy the latest `DueviaRecoveryCoordinator`, `DueviaContinuityGuard`, and `DueviaContinuityPool` from the connected project wallet.
- Supply at least two additional independent owner/observer wallet addresses, then deploy and configure the recovery multisig and observer quorum.
- Transfer Coordinator ownership to the multisig, authorize a funded Keeper role, and run a complete shadow rehearsal before enabling any automatic-suspension policy.
- Redeploy the latest DApp and record a short end-to-end demo.
- Publish the project X post mentioning `@XLayerOfficial` and submit the official form.

Already complete: public GitHub repository, production Workers AI binding, five-minute Keeper, persistent D1 state, Registry/legacy Guard/Pool testnet proof, linked SUSPENDED and VERIFIED attestations, and the verified 1 wei Pool deposit.

Do not submit private keys, seed phrases, API keys, raw borrower records, or unsigned screenshots as evidence.
