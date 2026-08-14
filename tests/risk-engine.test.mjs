import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCase } from "../lib/risk-engine.mjs";
import { demoCase } from "../lib/demo-case.mjs";

test("the demo case produces five callable modules and a review decision", () => {
  const report = analyzeCase(demoCase);
  assert.equal(report.modules.length, 5);
  assert.equal(report.status, "review");
  assert.ok(report.counts.high >= 1);
  assert.ok(report.modules.some((module) => module.id === "monitoring"));
});

test("an amount mismatch becomes a material finding", () => {
  const altered = structuredClone(demoCase);
  altered.documents[1].amount = 47000;
  const report = analyzeCase(altered);
  const documentModule = report.modules.find((module) => module.id === "documents");
  assert.ok(documentModule.findings.some((finding) => finding.code === "AMOUNT_MISMATCH"));
});
