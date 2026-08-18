# X Layer AI Season submission evidence

## Product

- Project: Duevia Continuity Agent
- Category: AI + RWA
- Public website: `https://duevia-rwa.cardrevive-agent.workers.dev`
- Public DApp: `https://duevia-rwa.cardrevive-agent.workers.dev/app`
- Public evidence: `https://duevia-rwa.cardrevive-agent.workers.dev/proof`
- Machine-readable evidence: `https://duevia-rwa.cardrevive-agent.workers.dev/api/evidence`
- Source: `https://github.com/yanwenzhe519-ctrl/duevia-rwa`
- Network: X Layer Testnet, chain ID `1952`

## Why this is infrastructure

Duevia is not a dashboard that asks a failed servicer for another upload. It is an X Layer continuity layer: independent observations trigger a deterministic incident state, an event-sourced engine produces `duevia.recovery-capsule/v1`, and schema-constrained AI investigates and cites that evidence under an independent verifier. A successor can only reopen capital flows after the recovery root and authorization are recorded. `DueviaRecoveryCoordinator` models `SUSPENDED`, `RECONSTRUCTED`, `REVIEW`, `RESTRUCTURING`, `VERIFIED`, and `CLOSED` so a default or servicing outage has an explicit onchain lifecycle.

## Live runtime evidence

- Persistent D1 database: `duevia-watchdog`
- Primary Keeper: Cloudflare Cron every five minutes
- Failover Keeper: GitHub Actions every five minutes, offset from the primary schedule
- X Layer scanner: chain ID `1952`, real `eth_blockNumber` and chunked `eth_getLogs`
- Live model: Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- Public intelligence adapters: GDELT DOC 2.0 with Google News RSS fallback
- External observer writes: allowlist, wallet signature, and nonce replay protection
- False-positive controls: multi-source threshold, two consecutive ordinary outage runs, shadow mode, and fail-closed AI verification
- Replay benchmark: `npm run bench:incidents` covers Maple/Orthogonal-style and Tugende-style synthetic incidents
- Release provenance: Git commit, deployment timestamp, Cloudflare Worker Version ID, contract addresses, and deployment transactions are published by `/api/evidence`

The two Keeper entries prove scheduler failover across Cloudflare and GitHub. They do not claim two independent observer organizations. Independent operating organizations remain a mainnet requirement.

## Final X Layer Testnet deployment

Project ID: `0x5c939e6382044f5bf74e865f5b497f038c90ec9dc65b96b36bd8b5d434ab3477`

| Contract | Address | Deployment transaction |
| --- | --- | --- |
| Asset Assurance Registry | `0x2f3Ca46E20b5fe5587Ccb3CCC9ba63F82713FC2C` | `0x887a08f0eb2b0033bb1b7b6935eb972af32c6f3230813cc38fecf28bc187e545` |
| Recovery Coordinator | `0x87d000cF49Ca890106BB259257bd5d1b186605cA` | `0xd59401ebb65f66127d915d5970bc1f61706a3ffff8e1613c7dc57b8303a51136` |
| Dual Eligibility Guard | `0x8Efe42614646c21d512b8B15418c53791d83B0fE` | `0x6761c2e638e67f5bdf9f4df68e551692f942ccaea7d50b06818d8bd0f3741664` |
| Continuity Pool | `0xCEC40281682fFd279d8414b828C40d7811F737c4` | `0xa06d391a79f7ca022291c79480c955fbce5e2703533dd176d47e8a4aadc0fd49` |
| Recovery Multisig | `0x11d698C4b9771BEc4C3DF7F27D07d2D9bEC7BB3c` | `0xe04642bd81110ca5307319f41cf73cc2bd67234d221561ce8ed271bfc198fe1b` |
| Observer Quorum | `0x444870d8776a95f403DD6A9A011e86433A9FB643` | `0xfbcfeeb908b7441cfb4aac06a3bfb46c0b23099948ed2aceb60ee19b8ecbb152` |

Governance evidence:

- Registry global ownership accepted: `0x65dfe81cc05bfadf548613385958b66ccb6000b31d7a918db0d1ea9c10e5634e`
- Coordinator global ownership accepted: `0x6f5f65a9a27c1a59c7593da7c9e078a7cae14a60ed07abefe099693a9eecfbf5`
- Registry project ownership accepted: `0xfa3703c7cc24e2a7d065fb29d6c19d2b5a01bc1bcc05d798053c29e8997f1ec5`
- Coordinator project ownership accepted: `0x8ef87178846800ce9e57e355d13bc34b6995e4a9193fb2c2df501f981b04f6ad`
- Global and project owners resolve to the Recovery Multisig.
- Pending global and project owners are zero addresses.
- Bootstrap global Attestor and Operator roles are revoked.
- Project-scoped Attestor and Operator roles remain enabled for the explicitly authorized rehearsal wallet.

## Final-stack incident rehearsal

- Project ID: `0x5c939e6382044f5bf74e865f5b497f038c90ec9dc65b96b36bd8b5d434ab3477`
- Incident ID: `0x3ea7e7e6a9c80f8a80ce63f0075affc0e8cfaf84c267d652514def87888ebd33`
- Recovery Root: `0x58318a3032ad1c918464dfeb9bbea47b16fd27d4b36087b0659781fa9cbf6b17`
- SUSPENDED attestation: `0xe56c5591731c52acd3aa906d710ab7443b9d46b4cd2dd27ba87272eb9408bfa4`
- VERIFIED successor attestation: `0xe044c7158ed81f1c9b395e47c0f8361885ef01b61d1fa8f14c18a1d1adcee30e`
- Pool rejection was verified by simulation while SUSPENDED; the final VERIFIED 1 wei deposit was accepted onchain.

Transactions:

- SUSPENDED Registry attestation: `0xf604e74c71eaff1f5a6db121a440f4b24f321d964fff127ff09bdac2dcf4b0bc` (block `38591749`)
- Coordinator incident opened: `0x33e87afc3210cad68c21a835a9a725482c8f2fed3469fd20098e6a6306a84ab3` (block `38591754`)
- Recovery Root recorded: `0x2b5c82a58ef8d16f24f6ebdecad6eff39cd6dc8cbd51fbbdec45b5ecca3c31bb` (block `38591883`)
- Successor proposed: `0x8d592420429f26368e4a751bf764eb6ad3304700c64fd1b82ebcd251b71f1390` (block `38591888`)
- VERIFIED Registry attestation: `0xb146b64c33f1754473467212a7b36859aef9e066fe042928b1d6ced3f501de7e` (block `38591892`)
- Successor verified: `0x389145183a53f8eff5ca5a71c97e75bd10eff80d36b4ba67aaeb3454d1f1d8e8` (block `38591896`)
- VERIFIED 1 wei deposit accepted: `0xbc35fcf72a84353db732c9f1fe85c39fdb2be34d6bdead6ef924288c2dfb0363` (block `38591900`)

## Historical enforcement proof

These transactions prove the earlier Registry/Guard/Pool enforcement flow. They are deliberately labelled as legacy evidence and are not represented as a final-stack incident rehearsal.

- SUSPENDED attestation: `0x653d0fb6ae23d2b6425444cab13d551a48b6e44a27e9772ef0a9c2c29099ba82`
- VERIFIED attestation: `0x28765800663e1dfa48ecbb9a09ead38673a0c9316e0e8faefc2862d66e1bfc55`
- Guard allow transaction: `0x150e19e69a22b8246d21bb510e3b491fb437c7d55f5c53b169bee6a5954815cb`
- Guard deployment transaction: `0x19ab65ad6cadb767224df3c98a8555f90a892a2239e46c3fdaf28b2375c3a27d`
- Guarded 1 wei Pool deposit: `0xe525d1b7fa4dc315a0b014c6f5e1d0e8a2fd66ce2bff0b346e37047c403f9a77`

## Remaining submission actions

- Record a short end-to-end product demo.
- Publish the project X post mentioning `@XLayerOfficial` and submit the official form.

Do not submit private keys, seed phrases, API keys, raw borrower records, or unsigned screenshots as evidence.
