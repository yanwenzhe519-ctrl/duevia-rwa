import test from "node:test";
import assert from "node:assert/strict";
import { replayIncident } from "../lib/incident-replay.mjs";
import { evaluateWatchdog } from "../lib/continuity-watchdog.mjs";

const snapshot = { poolId: "POOL-FAULT", capturedAt: "2026-08-14T00:00:00.000Z", source: "last-trusted", assets: [{ assetId: "A1", invoiceId: "I1", faceValue: 100, outstanding: 100, documentHash: "0xabc" }] };

test("incident replay freezes first and produces a recovery artifact from later evidence", () => {
  const replay = replayIncident({ servicerId: "SERVICER-FAULT", poolId: "POOL-FAULT", snapshot, timeline: [
    { at: "2026-08-14T12:00:00.000Z", heartbeatAt: "2026-08-14T00:00:00.000Z" },
    { at: "2026-08-15T08:00:00.000Z", signals: [{ type: "endpoint", source: "observer-a", ok: false }, { type: "endpoint", source: "observer-b", ok: false }], payments: [{ paymentId: "P1", invoiceId: "I1", amount: 20, paidAt: "2026-08-15T06:00:00.000Z" }], chainEvents: [{ eventId: "E1", invoiceId: "I1", txHash: "0xtx" }] },
  ] });
  assert.deepEqual(replay.states.map((state) => state.state), ["HEALTHY", "OUTAGE"]);
  assert.equal(replay.recoveryCapsule.assets[0].reconstructedOutstanding, 80);
  assert.match(replay.recoveryCapsule.recoveryRoot, /^0x[0-9a-f]{64}$/);
});

test("fault injection does not count one observer twice", () => {
  const result = evaluateWatchdog({ servicerId: "S", poolId: "P", lastHeartbeatAt: "2026-08-16T00:00:00.000Z", signals: [{ type: "endpoint", source: "same-observer", ok: false }, { type: "endpoint", source: "same-observer", ok: false }] }, "2026-08-16T12:00:00.000Z");
  assert.equal(result.state, "DEGRADED");
  assert.equal(result.shouldSuspend, false);
});

test("invalid signed servicing evidence immediately suspends", () => {
  const result = evaluateWatchdog({ servicerId: "S", poolId: "P", lastHeartbeatAt: "2026-08-16T00:00:00.000Z", signals: [{ type: "signature", source: "signed-feed", valid: false }] }, "2026-08-16T01:00:00.000Z");
  assert.equal(result.state, "INVALID_SIGNATURE");
  assert.equal(result.shouldSuspend, true);
});

