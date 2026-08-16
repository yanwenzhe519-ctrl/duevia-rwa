import test from "node:test";
import assert from "node:assert/strict";
import { reconstructAssetState } from "../lib/reconstruction-engine.mjs";

const base = {
  snapshot: { poolId: "POOL-1", source: "last-trusted-capsule", capturedAt: "2026-08-14T00:00:00.000Z", assets: [
    { assetId: "A-1", invoiceId: "I-1", debtor: "Buyer", faceValue: 100, outstanding: 100, documentHash: "0xaaa" },
    { assetId: "A-2", invoiceId: "I-2", debtor: "Buyer", faceValue: 50, outstanding: 50, documentHash: "0xbbb" },
  ] },
  payments: [{ paymentId: "P-1", invoiceId: "I-1", amount: 25, paidAt: "2026-08-15T00:00:00.000Z" }],
  chainEvents: [{ eventId: "E-1", invoiceId: "I-1", txHash: "0xtx" }],
  incident: { incidentId: "INC-1", servicerId: "servicer-1" },
};

test("reconstruction produces a portable capsule and applies independent payment evidence", () => {
  const capsule = reconstructAssetState(base);
  assert.equal(capsule.schema, "duevia.recovery-capsule/v1");
  assert.equal(capsule.incidentId, "INC-1");
  assert.equal(capsule.assets[0].reconstructedOutstanding, 75);
  assert.equal(capsule.assets[0].confidence, "MEDIUM");
  assert.match(capsule.recoveryRoot, /^0x[0-9a-f]{64}$/);
  assert.equal(capsule.independentEvidence.chainEvents, 1);
});

test("reconstruction marks assets without independent post-snapshot evidence for successor review", () => {
  const capsule = reconstructAssetState({ ...base, payments: [], chainEvents: [] });
  const asset = capsule.assets.find((candidate) => candidate.assetId === "A-2");
  assert.equal(capsule.state, "REVIEW");
  assert.equal(asset.nextAction, "successor-review");
  assert.ok(asset.conflicts.some((conflict) => conflict.code === "NO_POST_SNAPSHOT_PAYMENT_EVIDENCE"));
  assert.deepEqual(capsule.requiredApprovals, ["successor-servicer", "governance"]);
});

