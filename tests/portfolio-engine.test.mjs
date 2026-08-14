import assert from "node:assert/strict";
import test from "node:test";
import { analyzePortfolio, parseAssetTapeCsv } from "../lib/portfolio-engine.mjs";
import { portfolioDemo } from "../lib/portfolio-demo.mjs";

test("portfolio engine blocks duplicate financing and weak eligible coverage", () => {
  const report = analyzePortfolio(portfolioDemo);
  assert.equal(report.state, "suspended");
  assert.ok(report.alerts.some((alert) => alert.code === "DUPLICATE_INVOICE"));
  assert.ok(report.policy.some((rule) => rule.id === "NO_DUPLICATE_FINANCING" && !rule.passed));
  assert.ok(report.metrics.eligibleOutstanding < report.metrics.totalOutstanding);
});

test("asset tape CSV is parsed and evaluated", () => {
  const csv = [
    "assetId,invoiceId,originator,debtor,faceValue,outstanding,dueDate,status,bankAccount,documentHash,source,lastUpdatedAt",
    "AR-1,INV-1,Originator,Debtor A,50000,50000,2026-09-30,active,ACCT-1,sha256:1,ERP,2026-08-14",
    "AR-2,INV-2,Originator,Debtor B,50000,50000,2026-09-30,active,ACCT-1,sha256:2,Bank,2026-08-14",
  ].join("\n");
  const portfolio = parseAssetTapeCsv(csv, { asOf: "2026-08-14T12:00:00.000Z", tokenSupply: 90000 });
  const report = analyzePortfolio(portfolio);
  assert.equal(report.metrics.assetCount, 2);
  assert.equal(report.metrics.eligibleCoverage, 100000 / 90000);
  assert.equal(report.state, "review");
});
