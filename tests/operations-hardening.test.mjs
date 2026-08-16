import assert from "node:assert/strict";
import test from "node:test";
import { normalizeObserverEndpoints, normalizePublicEndpoint, observerStatusMessage, parseObserverStatus, verifyObserverStatus } from "../lib/observer-adapter.mjs";
import { evaluateOperationsHealth } from "../lib/operations-health.mjs";

const observer = `0x${"1".repeat(40)}`;
const envelope = {
  schema: "duevia.observer-status/v1",
  poolId: "POOL-1",
  observer,
  observedAt: "2026-08-17T01:00:00.000Z",
  status: "OUTAGE",
  evidenceHash: `0x${"2".repeat(64)}`,
  nonce: "observer-1:42",
  signature: `0x${"3".repeat(130)}`,
};

test("observer adapters require public unique HTTPS endpoints", () => {
  assert.deepEqual(normalizeObserverEndpoints(["https://observer-a.example/status", "https://observer-b.example/status"]), ["https://observer-a.example/status", "https://observer-b.example/status"]);
  assert.throws(() => normalizeObserverEndpoints(["http://observer.example/status"]), /HTTPS/);
  assert.throws(() => normalizeObserverEndpoints(["https://127.0.0.1/status"]), /private network/i);
  assert.throws(() => normalizeObserverEndpoints(["https://[fd00::1]/status"]), /private network/i);
  assert.throws(() => normalizeObserverEndpoints(["https://observer.example/status", "https://observer.example/status"]), /unique/);
  assert.equal(normalizePublicEndpoint("https://servicer.example/health#fragment"), "https://servicer.example/health");
  assert.throws(() => normalizePublicEndpoint("https://192.168.1.2/health"), /private network/);
});

test("observer status is fresh, pool-bound, allowlisted, and signature-bound", async () => {
  const parsed = parseObserverStatus(envelope, "POOL-1", "2026-08-17T01:05:00.000Z");
  assert.match(observerStatusMessage(parsed), /POOL-1/);
  const signal = await verifyObserverStatus(parsed, new Set([observer]), async ({ message }) => message === observerStatusMessage(parsed));
  assert.equal(signal.ok, false);
  assert.equal(signal.source, `observer:${observer}`);
  await assert.rejects(() => verifyObserverStatus(parsed, new Set(), async () => true), /not authorized/);
  assert.throws(() => parseObserverStatus(envelope, "POOL-2", "2026-08-17T01:05:00.000Z"), /poolId/);
  assert.throws(() => parseObserverStatus(envelope, "POOL-1", "2026-08-17T02:00:00.000Z"), /freshness/);
});

test("operations health detects missed cadence and records failover evidence", () => {
  const healthy = evaluateOperationsHealth({
    now: "2026-08-17T01:10:00.000Z",
    runs: [
      { finished_at: "2026-08-17T01:08:00.000Z", status: "ok", trigger_source: "primary-cron" },
      { finished_at: "2026-08-17T01:03:00.000Z", status: "ok", trigger_source: "secondary-keeper" },
    ],
    lease: { lease_until: "2026-08-17T01:09:00.000Z", holder: null },
    scanner: { updated_at: "2026-08-17T01:08:00.000Z" },
    enabledProjects: 2,
  });
  assert.equal(healthy.status, "HEALTHY");
  assert.equal(healthy.failover.status, "VERIFIED");

  const outage = evaluateOperationsHealth({ now: "2026-08-17T02:00:00.000Z", runs: [{ finished_at: "2026-08-17T01:00:00.000Z", status: "ok", trigger_source: "primary-cron" }] });
  assert.equal(outage.status, "OUTAGE");
  assert.equal(outage.failover.status, "UNPROVEN");

  const legacyIsNotFailover = evaluateOperationsHealth({
    now: "2026-08-17T01:10:00.000Z",
    runs: [
      { finished_at: "2026-08-17T01:08:00.000Z", status: "ok", trigger_source: "primary-cron" },
      { finished_at: "2026-08-17T01:03:00.000Z", status: "ok", trigger_source: "legacy" },
    ],
    scanner: { updated_at: "2026-08-17T01:08:00.000Z" },
  });
  assert.equal(legacyIsNotFailover.failover.status, "UNPROVEN");

  const nonConsecutiveErrors = evaluateOperationsHealth({
    now: "2026-08-17T01:10:00.000Z",
    runs: [
      { finished_at: "2026-08-17T01:08:00.000Z", status: "ok", trigger_source: "primary-cron" },
      { finished_at: "2026-08-17T01:07:00.000Z", status: "error", trigger_source: "primary-cron" },
      { finished_at: "2026-08-17T01:06:00.000Z", status: "error", trigger_source: "primary-cron" },
      { finished_at: "2026-08-17T01:05:00.000Z", status: "error", trigger_source: "primary-cron" },
    ],
    scanner: { updated_at: "2026-08-17T01:08:00.000Z" },
  });
  assert.equal(nonConsecutiveErrors.status, "HEALTHY");
  assert.equal(nonConsecutiveErrors.recentErrors, 3);
  assert.equal(nonConsecutiveErrors.consecutiveErrors, 0);
});
