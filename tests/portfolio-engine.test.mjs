import assert from "node:assert/strict";
import test from "node:test";
import { analyzePortfolio, parseAssetTapeCsv, parsePaymentsCsv } from "../lib/portfolio-engine.mjs";
import { portfolioDemo } from "../lib/portfolio-demo.mjs";
import { parseServicerFeed, servicerFeedStatus } from "../lib/servicer-feed.mjs";

test("portfolio engine blocks duplicate financing and weak eligible coverage", () => {
  const report = analyzePortfolio(portfolioDemo);
  assert.equal(report.state, "suspended");
  assert.ok(report.alerts.some((alert) => alert.code === "DUPLICATE_INVOICE"));
  assert.ok(report.policy.some((rule) => rule.id === "NO_DUPLICATE_FINANCING" && !rule.passed));
  assert.ok(report.metrics.eligibleOutstanding < report.metrics.totalOutstanding);
  assert.equal(report.metrics.reconciledCash, 16000);
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

test("payment ledger checks payer, beneficiary, and remaining balance", () => {
  const payments = parsePaymentsCsv([
    "paymentId,invoiceId,payer,beneficiaryAccount,amount,paidAt,source",
    "PAY-1,INV-1,Wrong Payer,ACCT-1,10000,2026-08-14,Bank",
  ].join("\n"));
  const portfolio = {
    poolId: "POOL-1",
    poolName: "Payment test",
    asOf: "2026-08-14T12:00:00.000Z",
    tokenSupply: 40000,
    assets: [{ assetId: "AR-1", invoiceId: "INV-1", originator: "Originator", debtor: "Debtor A", faceValue: 50000, outstanding: 40000, dueDate: "2026-09-30", status: "active", bankAccount: "ACCT-1", documentHash: "sha256:1", source: "ERP", lastUpdatedAt: "2026-08-14" }],
    payments,
  };
  const report = analyzePortfolio(portfolio);
  assert.ok(report.alerts.some((alert) => alert.code === "PAYMENT_PARTY_MISMATCH"));
  assert.ok(report.alerts.some((alert) => alert.code === "CASHFLOW_BALANCE_MISMATCH"));
  assert.equal(report.state, "suspended");
});

test("payment CSV preserves quoted commas and blocks negative amounts", () => {
  const payments = parsePaymentsCsv([
    "paymentId,invoiceId,payer,beneficiaryAccount,amount,paidAt,source",
    'PAY-1,INV-1,"Harbor, Logistics",ACCT-1,1000,2026-08-14,"Bank, statement"',
  ].join("\n"));
  assert.equal(payments[0].payer, "Harbor, Logistics");
  assert.equal(payments[0].source, "Bank, statement");
  const report = analyzePortfolio({
    poolId: "POOL-NEG",
    asOf: "2026-08-14T12:00:00.000Z",
    tokenSupply: 1,
    assets: [{ assetId: "AR-1", invoiceId: "INV-1", debtor: "Debtor", faceValue: 100, outstanding: 100, dueDate: "2026-09-30", bankAccount: "ACCT-1", lastUpdatedAt: "2026-08-14" }],
    payments: [{ paymentId: "PAY-N", invoiceId: "INV-1", payer: "Debtor", beneficiaryAccount: "ACCT-1", amount: -50 }],
  });
  assert.ok(report.alerts.some((alert) => alert.code === "NEGATIVE_PAYMENT"));
  assert.equal(report.metrics.reconciledCash, 0);
});

test("standard servicer feed validates provenance and detects a missed heartbeat", () => {
  const feed = parseServicerFeed({
    schema: "duevia.servicer-feed/v1",
    signature: "ed25519:demo-signature",
    snapshot: { poolId: "POOL-1", capturedAt: "2026-08-11T12:00:00.000Z", heartbeat: "healthy", source: "servicer-api" },
    assets: [{ assetId: "AR-1", invoiceId: "INV-1", documentHash: "sha256:abc" }],
    payments: [{ paymentId: "PAY-1", invoiceId: "INV-1" }],
  });
  assert.equal(feed.schema, "duevia.servicer-feed/v1");
  const status = servicerFeedStatus(feed, "2026-08-14T12:00:00.000Z");
  assert.equal(status.stale, true);
  assert.equal(Math.round(status.ageHours), 72);
});
