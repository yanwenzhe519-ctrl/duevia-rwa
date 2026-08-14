const REQUIRED_EVIDENCE = ["invoice", "purchase_order", "delivery_proof"];

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const finding = (severity, code, title, explanation, evidence = []) => ({ severity, code, title, explanation, evidence });

function daysBetween(first, second) {
  if (!first || !second) return null;
  const start = new Date(first).getTime();
  const end = new Date(second).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function statusFor(score) {
  if (score >= 85) return "verified";
  if (score >= 65) return "review";
  return "suspended";
}

function assuranceLevel(score, highCount) {
  if (highCount > 0 || score < 65) return "L1 · document-backed";
  if (score < 85) return "L2 · cross-checked";
  return "L3 · source-verified";
}

function analyzeEvidence(caseData) {
  const documents = caseData.documents ?? [];
  const types = new Set(documents.map((item) => item.type));
  const missing = REQUIRED_EVIDENCE.filter((type) => !types.has(type));
  const amounts = documents.map((item) => Number(item.amount)).filter((amount) => Number.isFinite(amount) && amount > 0);
  const currencies = new Set(documents.map((item) => item.currency).filter(Boolean));
  const uniqueAmounts = new Set(amounts.map((amount) => amount.toFixed(2)));
  const findings = [];
  let score = 100;

  if (missing.length) {
    score -= missing.length * 22;
    findings.push(finding("high", "EVIDENCE_MISSING", "Required evidence is missing", `Missing evidence types: ${missing.join(", ")}.`, missing));
  } else {
    findings.push(finding("low", "EVIDENCE_COMPLETE", "Core evidence package is complete", "Invoice, purchase order, and delivery proof are present.", REQUIRED_EVIDENCE));
  }

  if (uniqueAmounts.size > 1) {
    score -= 26;
    findings.push(finding("high", "AMOUNT_MISMATCH", "Amounts do not reconcile", "The submitted evidence contains different transaction amounts.", documents.filter((item) => item.amount).map((item) => `${item.name}: ${item.amount}`)));
  } else if (amounts.length > 1) {
    findings.push(finding("low", "AMOUNT_RECONCILED", "Amounts reconcile across evidence", `All material evidence reports ${amounts[0].toLocaleString()} ${caseData.asset?.currency ?? ""}.`, documents.filter((item) => item.amount).map((item) => item.name)));
  }

  if (currencies.size > 1) {
    score -= 15;
    findings.push(finding("medium", "CURRENCY_MISMATCH", "Multiple currencies detected", `Evidence contains ${Array.from(currencies).join(", ")}. Confirm the conversion basis.`));
  }

  return { id: "documents", name: "Evidence Intelligence", shortName: "Evidence", score: clamp(score), status: statusFor(score), summary: `${documents.length} evidence items · ${missing.length || "No"} required items missing`, findings };
}

function analyzeEntity(caseData) {
  const issuer = caseData.issuer ?? {};
  const findings = [];
  let score = 100;
  if (issuer.kybStatus !== "verified") {
    score -= 28;
    findings.push(finding("high", "KYB_UNVERIFIED", "Issuer identity is not verified", "Independent business verification is required before this asset can be relied upon."));
  } else {
    findings.push(finding("low", "KYB_VERIFIED", "Issuer identity is current", `Verification status: verified in ${issuer.jurisdiction}.`, [issuer.legalName]));
  }
  if (issuer.sanctionsStatus && issuer.sanctionsStatus !== "clear") {
    score -= 70;
    findings.push(finding("high", "SANCTIONS_ALERT", "Sanctions screening requires escalation", "The submitted screening result is not clear. Stop automated processing."));
  }
  if (issuer.bankAccountHolder && issuer.legalName && issuer.bankAccountHolder.trim().toLowerCase() !== issuer.legalName.trim().toLowerCase()) {
    score -= 38;
    findings.push(finding("high", "ACCOUNT_HOLDER_MISMATCH", "Payment account does not match the issuer", `The issuer is ${issuer.legalName}, while the receiving account belongs to ${issuer.bankAccountHolder}.`, ["Invoice supplier name", "Payment instruction account holder"]));
  }
  return { id: "entity", name: "Entity & Authority", shortName: "Entity", score: clamp(score), status: statusFor(score), summary: `${issuer.legalName ?? "Unknown issuer"} · ${issuer.jurisdiction ?? "Jurisdiction unavailable"}`, findings };
}

function analyzeAsset(caseData) {
  const asset = caseData.asset ?? {};
  const documents = caseData.documents ?? [];
  const invoice = documents.find((item) => item.type === "invoice");
  const purchaseOrder = documents.find((item) => item.type === "purchase_order");
  const findings = [];
  let score = 100;
  const reportedValue = Number(asset.reportedValue);
  const tokenSupply = Number(asset.tokenSupply);
  const unitValue = Number(asset.unitValue || 1);
  const representedValue = tokenSupply * unitValue;
  const coverage = representedValue > 0 ? (reportedValue / representedValue) * 100 : 0;

  if (!Number.isFinite(coverage) || coverage <= 0) {
    score -= 45;
    findings.push(finding("high", "COVERAGE_UNAVAILABLE", "Coverage cannot be calculated", "Asset value or represented supply data is missing."));
  } else if (coverage < 100) {
    score -= Math.min(55, 20 + (100 - coverage));
    findings.push(finding("high", "UNDERCOLLATERALIZED", "Reported coverage is below 100%", `Calculated coverage is ${coverage.toFixed(1)}%.`, ["Reported asset value", "Token supply", "Unit value"]));
  } else {
    findings.push(finding("low", "COVERAGE_RECONCILED", "Reported value covers represented supply", `Calculated coverage is ${coverage.toFixed(1)}%. This confirms data consistency, not legal ownership.`, ["Asset schedule", "Supply snapshot"]));
  }

  const deliveryGap = daysBetween(invoice?.dueDate, purchaseOrder?.deliveryDate);
  if (deliveryGap !== null && deliveryGap > 0) {
    score -= 24;
    findings.push(finding("medium", "PAYMENT_BEFORE_DELIVERY", "Payment falls due before delivery", `The payment due date is ${deliveryGap} day(s) before the scheduled delivery date.`, [invoice?.name, purchaseOrder?.name].filter(Boolean)));
  }
  return { id: "asset", name: "Asset & Cash-flow", shortName: "Asset", score: clamp(score), status: statusFor(score), summary: `${Number.isFinite(coverage) ? coverage.toFixed(1) : "—"}% reported coverage · ${asset.currency ?? "—"}`, metrics: { coverage: Number.isFinite(coverage) ? coverage : null, representedValue, reportedValue }, findings };
}

function analyzeMonitoring(caseData) {
  const lastUpdatedAt = caseData.monitoring?.lastUpdatedAt ?? caseData.issuer?.lastVerifiedAt;
  const asOf = caseData.asOf ?? new Date().toISOString();
  const ageDays = daysBetween(lastUpdatedAt, asOf);
  const findings = [];
  let score = 100;
  if (ageDays === null) {
    score -= 35;
    findings.push(finding("high", "FRESHNESS_UNKNOWN", "Data freshness is unknown", "No reliable update timestamp was provided."));
  } else if (ageDays > 30) {
    score -= 45;
    findings.push(finding("high", "DATA_STALE", "Material data is stale", `The latest verification is ${ageDays} days old.`));
  } else if (ageDays > 7) {
    score -= 20;
    findings.push(finding("medium", "REFRESH_DUE", "A refresh is recommended", `The latest verification is ${ageDays} days old.`));
  } else {
    findings.push(finding("low", "DATA_CURRENT", "Monitoring data is current", `The latest verification is ${ageDays} day(s) old.`));
  }
  return { id: "monitoring", name: "Monitoring & Attestation", shortName: "Monitor", score: clamp(score), status: statusFor(score), summary: lastUpdatedAt ? `Last verified ${lastUpdatedAt.slice(0, 10)}` : "Update time unavailable", findings };
}

export function analyzeCase(caseData) {
  const evidence = analyzeEvidence(caseData);
  const entity = analyzeEntity(caseData);
  const asset = analyzeAsset(caseData);
  const monitoring = analyzeMonitoring(caseData);
  const evidenceModules = [evidence, entity, asset, monitoring];
  const overallScore = clamp(evidence.score * 0.28 + entity.score * 0.27 + asset.score * 0.27 + monitoring.score * 0.18);
  const materialFindings = evidenceModules.flatMap((module) => module.findings);
  const highCount = materialFindings.filter((item) => item.severity === "high").length;
  const mediumCount = materialFindings.filter((item) => item.severity === "medium").length;
  const status = statusFor(overallScore);
  const riskModule = {
    id: "risk", name: "Assurance Decision", shortName: "Decision", score: overallScore, status,
    summary: `${highCount} high · ${mediumCount} medium · policy TRADE_RECEIVABLES_V1`,
    findings: materialFindings.filter((item) => item.severity !== "low").sort((a, b) => (a.severity === "high" && b.severity !== "high" ? -1 : 1)),
  };
  const decision = overallScore >= 85 && highCount === 0 ? "Asset assurance verified" : overallScore >= 55 ? "Manual review required" : "Asset assurance suspended";
  return {
    reportId: `DUE-${caseData.caseId ?? "UNASSIGNED"}-V1`, caseId: caseData.caseId ?? "UNASSIGNED", assetName: caseData.asset?.name ?? "Unnamed asset", generatedAt: new Date().toISOString(), score: overallScore, status, decision,
    assuranceLevel: assuranceLevel(overallScore, highCount),
    validUntil: caseData.monitoring?.validUntil ?? null,
    policyId: caseData.asset?.policyId ?? "TRADE_RECEIVABLES_V1",
    counts: { high: highCount, medium: mediumCount, passed: materialFindings.filter((item) => item.severity === "low").length },
    modules: [evidence, entity, asset, riskModule, monitoring], methodology: "Duevia Asset Assurance Model v1.0",
    disclaimer: "Duevia verifies submitted evidence and consistency controls. It is not a legal opinion, audit, credit rating, or guarantee of asset ownership or repayment.",
  };
}

export function canonicalizeReport(report) {
  const sortValue = (value) => {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value && typeof value === "object") return Object.keys(value).sort().reduce((result, key) => ({ ...result, [key]: sortValue(value[key]) }), {});
    return value;
  };
  return JSON.stringify(sortValue(report));
}
