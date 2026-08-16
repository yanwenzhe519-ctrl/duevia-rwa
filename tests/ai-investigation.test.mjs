import test from "node:test";
import assert from "node:assert/strict";
import { collectEvidenceIds, failedInvestigation, modelResponseObject, parseModelJson, validateInvestigation, validateModelVerifier } from "../lib/ai-investigation.mjs";

const evidence = { observations: [{ observationId: "OBS-1", transactionHash: "0xtx" }], recoveryRoot: "0xroot" };
const valid = { schema: "duevia.ai-investigation/v1", incidentId: "INC-1", summary: "Heartbeat and endpoint evidence support an outage review.", riskLevel: "HIGH", facts: [{ claim: "The observer reported an outage.", evidenceIds: ["OBS-1"] }], inferences: [{ claim: "Servicing may be interrupted.", basis: "Heartbeat and endpoint failure", confidence: "MEDIUM" }], missingEvidence: [{ item: "Bank confirmation", impact: "Cash recovery remains uncertain." }], recommendedActions: [{ action: "Suspend new deposits", reason: "Protect the pool while evidence is reviewed.", requiresApproval: true }] };

test("AI investigation parser accepts fenced JSON but no free-form prose", () => {
  assert.deepEqual(parseModelJson(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``), valid);
  assert.throws(() => parseModelJson("No structured result"));
  assert.deepEqual(modelResponseObject({ response: valid }), valid);
  assert.deepEqual(modelResponseObject({ response: JSON.stringify(valid) }), valid);
});

test("deterministic verifier requires real evidence citations", () => {
  const ids = [...collectEvidenceIds(evidence)];
  assert.deepEqual(ids.sort(), ["0xroot", "0xtx", "OBS-1"].sort());
  assert.equal(validateInvestigation(valid, ids).valid, true);
  const hallucinated = structuredClone(valid);
  hallucinated.facts[0].evidenceIds = ["MADE-UP"];
  const result = validateInvestigation(hallucinated, ids);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((item) => item.includes("unknown evidence")));
});

test("material AI actions cannot bypass approval and model verifier must agree", () => {
  const unsafe = structuredClone(valid);
  unsafe.recommendedActions[0].requiresApproval = false;
  assert.equal(validateInvestigation(unsafe, ["OBS-1"]).valid, false);
  assert.equal(validateModelVerifier({ valid: true, unsupportedClaims: [], reason: "supported" }).valid, true);
  assert.equal(validateModelVerifier({ valid: true, unsupportedClaims: ["unsupported"], reason: "bad" }).valid, false);
});

test("malformed model output becomes a persisted review-required investigation", () => {
  const fallback = failedInvestigation("INC-FAIL", "Malformed JSON");
  assert.equal(fallback.incidentId, "INC-FAIL");
  assert.equal(fallback.recommendedActions[0].requiresApproval, true);
  assert.equal(validateInvestigation(fallback, ["OBS-1"]).valid, false);
});
