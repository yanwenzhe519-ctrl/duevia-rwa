const DAY = 86_400_000;
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function ageInDays(date, asOf) {
  const start = new Date(date).getTime();
  const end = new Date(asOf).getTime();
  return Number.isFinite(start) && Number.isFinite(end) ? Math.floor((end - start) / DAY) : null;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  values.push(current.trim());
  return values;
}

export function analyzePortfolio(portfolio) {
  const assets = Array.isArray(portfolio.assets) ? portfolio.assets : [];
  const payments = Array.isArray(portfolio.payments) ? portfolio.payments : [];
  const asOf = portfolio.asOf || new Date().toISOString();
  const tokenSupply = number(portfolio.tokenSupply);
  const totalOutstanding = assets.reduce((sum, asset) => sum + number(asset.outstanding), 0);
  const totalFaceValue = assets.reduce((sum, asset) => sum + number(asset.faceValue), 0);
  const alerts = [];
  const invoiceMap = new Map();
  const hashMap = new Map();

  for (const asset of assets) {
    if (asset.invoiceId) invoiceMap.set(asset.invoiceId, [...(invoiceMap.get(asset.invoiceId) || []), asset.assetId]);
    if (asset.documentHash) hashMap.set(asset.documentHash, [...(hashMap.get(asset.documentHash) || []), asset.assetId]);
  }

  const duplicateAssets = new Set();
  for (const [invoiceId, ids] of invoiceMap) {
    if (ids.length > 1) {
      ids.forEach((id) => duplicateAssets.add(id));
      alerts.push({ severity: "high", code: "DUPLICATE_INVOICE", title: `Invoice ${invoiceId} appears in multiple assets`, assets: ids, action: "Block financing until ownership and prior pledges are resolved." });
    }
  }
  for (const [hash, ids] of hashMap) {
    if (ids.length > 1 && !ids.every((id) => duplicateAssets.has(id))) {
      ids.forEach((id) => duplicateAssets.add(id));
      alerts.push({ severity: "high", code: "DUPLICATE_EVIDENCE", title: "Identical evidence fingerprint detected", assets: ids, action: `Review evidence fingerprint ${hash}.` });
    }
  }

  const validPaymentTotals = new Map();
  for (const payment of payments) {
    if (number(payment.amount) < 0) {
      alerts.push({ severity: "high", code: "NEGATIVE_PAYMENT", title: `Payment ${payment.paymentId || "unknown"} has a negative amount`, assets: [], action: "Reject the payment row and request a corrected bank record." });
      continue;
    }
    const asset = assets.find((candidate) => candidate.invoiceId === payment.invoiceId);
    if (!asset) {
      alerts.push({ severity: "medium", code: "UNMATCHED_PAYMENT", title: `Payment ${payment.paymentId || "unknown"} has no matching invoice`, assets: [], action: "Resolve the payment reference before applying it to pool cash flows." });
      continue;
    }
    const payerMatches = String(payment.payer || "").trim().toLowerCase() === String(asset.debtor || "").trim().toLowerCase();
    const beneficiaryMatches = String(payment.beneficiaryAccount || "").trim().toLowerCase() === String(asset.bankAccount || "").trim().toLowerCase();
    if (!payerMatches || !beneficiaryMatches) {
      alerts.push({ severity: "high", code: "PAYMENT_PARTY_MISMATCH", title: `Payment ${payment.paymentId || "unknown"} fails party reconciliation`, assets: [asset.assetId], action: "Do not recognize the cash flow until payer and beneficiary are verified." });
      continue;
    }
    validPaymentTotals.set(asset.invoiceId, (validPaymentTotals.get(asset.invoiceId) || 0) + number(payment.amount));
  }

  const assessedAssets = assets.map((asset) => {
    const daysPastDue = ageInDays(asset.dueDate, asOf);
    const freshnessDays = ageInDays(asset.lastUpdatedAt, asOf);
    const duplicate = duplicateAssets.has(asset.assetId);
    const overdue = daysPastDue !== null && daysPastDue > 0 && number(asset.outstanding) > 0;
    const stale = freshnessDays === null || freshnessDays > 7;
    if (overdue) alerts.push({ severity: daysPastDue > 30 ? "high" : "medium", code: "PAYMENT_OVERDUE", title: `${asset.assetId} is ${daysPastDue} day(s) past due`, assets: [asset.assetId], action: "Confirm payment status with the servicer and refresh expected cash flow." });
    if (stale) alerts.push({ severity: "medium", code: "SOURCE_STALE", title: `${asset.assetId} source data is stale`, assets: [asset.assetId], action: "Refresh the connected source before the next eligibility check." });
    const reconciledPayments = validPaymentTotals.get(asset.invoiceId) || 0;
    const expectedOutstanding = Math.max(0, number(asset.faceValue) - reconciledPayments);
    const balanceMismatch = Math.abs(expectedOutstanding - number(asset.outstanding)) > 0.01;
    if (balanceMismatch) alerts.push({ severity: "high", code: "CASHFLOW_BALANCE_MISMATCH", title: `${asset.assetId} reported balance does not reconcile to verified payments`, assets: [asset.assetId], action: `Expected ${expectedOutstanding.toFixed(2)} outstanding after recognized payments; reported ${number(asset.outstanding).toFixed(2)}.` });
    const eligible = !duplicate && !overdue && !stale && !balanceMismatch && asset.status !== "repaid";
    return { ...asset, daysPastDue: Math.max(0, daysPastDue || 0), freshnessDays, duplicate, eligible, reconciledPayments, expectedOutstanding, balanceMismatch };
  });

  const debtorExposure = assessedAssets.reduce((result, asset) => {
    result[asset.debtor || "Unknown"] = (result[asset.debtor || "Unknown"] || 0) + number(asset.outstanding);
    return result;
  }, {});
  const concentration = Object.entries(debtorExposure)
    .map(([debtor, exposure]) => ({ debtor, exposure, share: totalOutstanding ? exposure / totalOutstanding : 0 }))
    .sort((a, b) => b.exposure - a.exposure);
  if (concentration[0]?.share > 0.4) alerts.push({ severity: "medium", code: "DEBTOR_CONCENTRATION", title: `${concentration[0].debtor} represents ${(concentration[0].share * 100).toFixed(1)}% of exposure`, assets: assessedAssets.filter((asset) => asset.debtor === concentration[0].debtor).map((asset) => asset.assetId), action: "Apply the pool concentration limit or require additional diversification." });

  const eligibleOutstanding = assessedAssets.filter((asset) => asset.eligible).reduce((sum, asset) => sum + number(asset.outstanding), 0);
  const grossCoverage = tokenSupply ? totalOutstanding / tokenSupply : 0;
  const eligibleCoverage = tokenSupply ? eligibleOutstanding / tokenSupply : 0;
  if (eligibleCoverage < 1) alerts.push({ severity: "high", code: "ELIGIBLE_COVERAGE", title: `Eligible collateral covers only ${(eligibleCoverage * 100).toFixed(1)}% of represented supply`, assets: assessedAssets.filter((asset) => !asset.eligible).map((asset) => asset.assetId), action: "Suspend new issuance or add eligible collateral." });

  const highAlerts = alerts.filter((alert) => alert.severity === "high").length;
  const mediumAlerts = alerts.filter((alert) => alert.severity === "medium").length;
  const state = highAlerts ? "suspended" : mediumAlerts ? "review" : "verified";

  return {
    poolId: portfolio.poolId || "UNASSIGNED",
    poolName: portfolio.poolName || "Unnamed pool",
    asOf,
    state,
    metrics: { assetCount: assets.length, paymentCount: payments.length, totalFaceValue, totalOutstanding, eligibleOutstanding, reconciledCash: Array.from(validPaymentTotals.values()).reduce((sum, value) => sum + value, 0), grossCoverage, eligibleCoverage, highAlerts, mediumAlerts },
    assets: assessedAssets,
    alerts,
    concentration,
    policy: [
      { id: "NO_DUPLICATE_FINANCING", label: "No duplicate invoice or evidence fingerprint", passed: duplicateAssets.size === 0 },
      { id: "CASHFLOW_RECONCILED", label: "Servicer balances reconcile to verified payment events", passed: !assessedAssets.some((asset) => asset.balanceMismatch) && !alerts.some((alert) => alert.code === "PAYMENT_PARTY_MISMATCH") },
      { id: "NO_PAST_DUE_ASSETS", label: "No unpaid asset past its due date", passed: !assessedAssets.some((asset) => asset.daysPastDue > 0) },
      { id: "SOURCE_FRESHNESS_7D", label: "Every material source refreshed within 7 days", passed: !assessedAssets.some((asset) => asset.freshnessDays === null || asset.freshnessDays > 7) },
      { id: "ELIGIBLE_COVERAGE_100", label: "Eligible outstanding balance covers represented supply", passed: eligibleCoverage >= 1 },
      { id: "DEBTOR_LIMIT_40", label: "Single debtor exposure does not exceed 40%", passed: !concentration[0] || concentration[0].share <= 0.4 },
    ],
  };
}

export function parseAssetTapeCsv(text, defaults = {}) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV requires a header and at least one asset row.");
  const headers = parseCsvLine(lines[0]);
  const required = ["assetId", "invoiceId", "originator", "debtor", "faceValue", "outstanding", "dueDate", "lastUpdatedAt"];
  if (required.some((field) => !headers.includes(field))) throw new Error(`Missing required columns: ${required.filter((field) => !headers.includes(field)).join(", ")}`);
  const assets = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
  return { poolId: defaults.poolId || "IMPORTED-POOL", poolName: defaults.poolName || "Imported receivables pool", asOf: defaults.asOf || new Date().toISOString(), tokenSupply: number(defaults.tokenSupply) || assets.reduce((sum, asset) => sum + number(asset.outstanding), 0), assets, payments: [] };
}

export function parsePaymentsCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Payment CSV requires a header and at least one payment row.");
  const headers = parseCsvLine(lines[0]);
  const required = ["paymentId", "invoiceId", "payer", "beneficiaryAccount", "amount", "paidAt", "source"];
  if (required.some((field) => !headers.includes(field))) throw new Error(`Missing payment columns: ${required.filter((field) => !headers.includes(field)).join(", ")}`);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}
