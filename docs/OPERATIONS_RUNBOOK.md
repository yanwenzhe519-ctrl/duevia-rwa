# Duevia operations, failover, and rollback

This runbook covers the hosted observation and recovery runtime. It does not authorize mainnet capital controls.

## Service-level objectives

- Primary Keeper cadence: every 5 minutes.
- Degraded: no successful completion for 10 minutes, latest run failed, or the X Layer cursor is stale for 20 minutes.
- Outage: no completion for 20 minutes or at least 3 consecutive Keeper failures. Total errors in the latest 24 runs remain visible as diagnostic metadata.
- Adapter timeout: 8 seconds per endpoint; response body limit: 64 KB.
- X Layer confirmation depth: 12 blocks on the testnet scanner. Every stored checkpoint carries `finalityStatus`, `confirmationDepth`, and the RPC source so preconfirmed, confirmed, and finalized states cannot be conflated.

`GET /api/operations/health` is the machine-readable health contract. It reports Keeper freshness, recent errors, scan-cursor age, lease activity, enabled project count, and whether two distinct Keeper trigger sources have completed successfully.

## Redundant Keeper

The Cloudflare cron is the primary trigger. A separately operated monitor should call `POST /api/keeper/run` every five minutes with:

```text
Authorization: Bearer <WATCHDOG_ADMIN_TOKEN>
X-Duevia-Keeper-Id: secondary-keeper-<operator>
```

Both triggers use the same D1 lease. Only one can advance the shared cursor at a time. A `keeper-lease-held` response is normal and proves overlap prevention. Failover is only `VERIFIED` after successful runs from at least two distinct trigger IDs appear in operational health.

Never place the administrator token in browser code, CI logs, screenshots, or a `NEXT_PUBLIC_*` variable. Rotate it after operator changes.

## Signed observer adapters

Register up to five public HTTPS endpoints through the administrator project API. Each endpoint must return `duevia.observer-status/v1`, remain under 64 KB, be no older than 15 minutes, match the registered pool, and carry an EIP-191 signature from an address in `WATCHDOG_OBSERVER_ADDRESSES`.

Generic HTTP availability is retained only as a weak endpoint signal. An HTTP 200 response never advances the trusted servicing heartbeat. Only current onchain activity, a valid signed servicer feed, or a valid signed observer status can advance trusted state.

## Incident response

1. Check `/api/operations/health`; distinguish a Keeper outage from a monitored servicer outage.
2. Confirm the X Layer RPC cursor and D1 lease are progressing.
3. Trigger the secondary Keeper once. Do not bypass the lease or modify the cursor manually.
4. Keep automatic broadcasting disabled. Inspect the redacted incident, Capsule root, deterministic validation, and AI verifier result.
5. Require two observer-quorum votes and the recovery multisig before executing an onchain suspension.
6. Preserve logs, Worker version, Git commit, transaction hashes, block numbers, and Recovery Root.

## Worker release and rollback

1. Run lint, typecheck, contract compilation consistency, tests, incident benchmarks, and dependency audit.
2. Apply additive D1 migrations before code that reads new columns.
   Migration `0011_rwa_vault_address.sql` also pins `DUEVIA-RCV-018` to the RPC-verified takeover addresses and uses the RWA Vault as its scanner contract.
3. Deploy the Worker and verify `/`, `/app`, `/proof`, `/api/agent/health`, and `/api/operations/health`.
4. Keep the prior Cloudflare Worker version available during the observation window.
5. If the release fails, roll traffic back to the prior Worker version. Do not reverse an applied D1 migration; migrations are additive and the previous Worker must tolerate extra columns.
6. Record the failed version and error as an operational incident before retrying.

## Contract upgrade and rollback

The reference contracts are intentionally non-upgradeable. There is no proxy administrator that can silently replace code.

1. Deploy new contracts with a new deterministic salt and record their bytecode hashes.
2. Run the full shadow incident rehearsal against the new addresses.
3. Approve migration through the recovery multisig and observer quorum.
4. Update integrations only after Registry and Coordinator ownership and roles are verified.
5. Rollback means returning integrations to the previous immutable contract set through governance; it never means changing deployed bytecode.

Mainnet remains prohibited until an independent audit, signer custody review, real adapter pilot, economic-limit review, and disaster-recovery exercise are complete.
