import assert from "node:assert/strict";
import test from "node:test";
import { capsuleForReconstruction, validateAccountReconstruction } from "../lib/account-reconstruction.mjs";

const account = "0x1111111111111111111111111111111111111111";
const input = { evidence: [{ id: "checkpoint:1", source: "xlayer", observedAt: "2026-08-19T00:00:00Z", hash: "0x01" }] };
const row = { account, previous: { principal: "100", yield: "5", pendingRedemption: "10" }, reconstructed: { principal: "90", yield: "7", pendingRedemption: "20" }, stateDiff: { principalDelta: "-10", yieldDelta: "2", redemptionDelta: "10" }, evidenceRefs: ["checkpoint:1"], assumptions: [], conflicts: [], confidence: 0.95, status: "PENDING_VALIDATION" };

test("accepts multiple evidence-grounded conserved candidates", () => {
  const output = { schema: "duevia.account-reconstruction/v1", candidates: [{ candidateId: "confirmed", accounts: [row] }, { candidateId: "conservative", accounts: [{ ...row, confidence: 0.9 }] }] };
  const validation = validateAccountReconstruction(output, input);
  assert.equal(validation.valid, true);
  const capsule = capsuleForReconstruction("project", "incident", output, validation, { valid: true });
  assert.equal(capsule.executable, true);
  assert.match(capsule.capsuleHash, /^0x[0-9a-f]{64}$/);
});

test("rejects unknown evidence, low confidence, and broken state diffs", () => {
  const invalid = { ...row, stateDiff: { ...row.stateDiff, principalDelta: "0" }, evidenceRefs: ["missing"], confidence: 0.2 };
  const validation = validateAccountReconstruction({ schema: "duevia.account-reconstruction/v1", candidates: [{ candidateId: "a", accounts: [invalid] }, { candidateId: "b", accounts: [invalid] }] }, input);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("PRINCIPAL_NOT_CONSERVED"));
  assert.ok(validation.errors.includes("UNKNOWN_EVIDENCE_REF"));
  assert.ok(validation.errors.includes("LOW_CONFIDENCE"));
});
