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
  assert.equal(capsule.assets[0].confidence, "HIGH");
  assert.equal(capsule.accountingModel, "event-sourced-minor-units/v1");
  assert.equal(capsule.assets[0].accountingInvariantDeltaMinor, "0");
  assert.match(capsule.recoveryRoot, /^0x[0-9a-f]{64}$/);
  assert.equal(capsule.independentEvidence.chainEvents, 1);
});

test("reconstruction marks assets without independent post-snapshot evidence for successor review", () => {
  const capsule = reconstructAssetState({ ...base, payments: [], chainEvents: [] });
  const asset = capsule.assets.find((candidate) => candidate.assetId === "A-2");
  assert.equal(capsule.state, "REVIEW");
  assert.equal(asset.nextAction, "successor-review");
  assert.ok(asset.conflicts.some((conflict) => conflict.code === "NO_POST_SNAPSHOT_EVIDENCE"));
  assert.deepEqual(capsule.requiredApprovals, ["successor-servicer", "governance"]);
});

test("ledger applies only unique confirmed post-cutoff events", () => {
  const capsule = reconstructAssetState({ ...base, payments: [
    { paymentId: "OLD", invoiceId: "I-1", amount: 90, paidAt: "2026-08-13T00:00:00.000Z" },
    { paymentId: "DUP", invoiceId: "I-1", amount: 10, paidAt: "2026-08-15T00:00:00.000Z" },
    { paymentId: "DUP", invoiceId: "I-1", amount: 10, paidAt: "2026-08-15T00:00:00.000Z" },
  ] });
  const asset = capsule.assets[0];
  assert.equal(asset.reconstructedOutstanding, 100);
  assert.ok(asset.excludedEvents.some((event) => event.reason === "AT_OR_BEFORE_SNAPSHOT_CUTOFF"));
  assert.ok(asset.conflicts.some((conflict) => conflict.code === "DUPLICATE_LEDGER_EVENT"));
});

test("ledger reconciles interest, fees, recoveries, and write-downs in minor units", () => {
  const capsule = reconstructAssetState({ ...base, payments: [], ledgerEvents: [
    { eventId: "INT-1", invoiceId: "I-1", type: "INTEREST", amount: "2.50", observedAt: "2026-08-15T01:00:00.000Z" },
    { eventId: "FEE-1", invoiceId: "I-1", type: "FEE", amount: "1.25", observedAt: "2026-08-15T02:00:00.000Z" },
    { eventId: "REC-1", invoiceId: "I-1", type: "RECOVERY", amount: "10.00", observedAt: "2026-08-15T03:00:00.000Z" },
    { eventId: "WD-1", invoiceId: "I-1", type: "WRITE_DOWN", amount: "5.00", observedAt: "2026-08-15T04:00:00.000Z" },
  ], publicSignals: [{ poolId: "POOL-1", source: "court-filing", observedAt: "2026-08-15T05:00:00.000Z" }] });
  const asset = capsule.assets[0];
  assert.equal(asset.reconstructedOutstanding, 88.75);
  assert.equal(asset.interestAccruedMinor, "250");
  assert.equal(asset.feesAccruedMinor, "125");
  assert.equal(asset.recoveriesAppliedMinor, "1000");
  assert.equal(asset.writeDownsMinor, "500");
  assert.equal(asset.accountingInvariantDeltaMinor, "0");
});

test("party and currency conflicts cannot silently change balances", () => {
  const capsule = reconstructAssetState({ snapshot: { ...base.snapshot, assets: [{ ...base.snapshot.assets[0], bankAccount: "CONTROLLED", currency: "USD" }] }, payments: [
    { paymentId: "BAD-1", invoiceId: "I-1", amount: 25, currency: "EUR", payer: "Other", beneficiaryAccount: "UNKNOWN", paidAt: "2026-08-15T00:00:00.000Z" },
  ] });
  assert.equal(capsule.assets[0].reconstructedOutstanding, 100);
  assert.ok(capsule.assets[0].conflicts.some((conflict) => conflict.code === "CURRENCY_MISMATCH"));
});
