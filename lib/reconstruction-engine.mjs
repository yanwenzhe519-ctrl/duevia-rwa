import { createHash } from "node:crypto";

const iso = (value) => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const required = (value, field) => { const text = String(value || "").trim(); if (!text) throw new Error(`${field} is required.`); return text; };

function canonical(value) {
  if (value === undefined || value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return `0x${createHash("sha256").update(canonical(value)).digest("hex")}`; }

function toMinor(value, decimals, field) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`${field} must be a non-negative decimal amount.`);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error(`${field} exceeds ${decimals} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}

function fromMinor(value, decimals) {
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

const asDisplayNumber = (minor, decimals) => Number(fromMinor(minor, decimals));
const partyMatches = (actual, expected) => !actual || !expected || String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();

/**
 * Snapshot balances form the opening ledger at capturedAt. Only unique,
 * confirmed events after that cutoff are applied, using integer minor units.
 */
export function reconstructAssetState({ snapshot = {}, payments = [], ledgerEvents = [], chainEvents = [], publicSignals = [], incident = {} } = {}) {
  const capturedAt = iso(snapshot.capturedAt);
  if (!capturedAt) throw new Error("snapshot.capturedAt must be a valid ISO timestamp.");
  const cutoffMs = Date.parse(capturedAt);
  const assets = Array.isArray(snapshot.assets) ? snapshot.assets : [];
  if (!assets.length) throw new Error("snapshot.assets must contain at least one asset.");
  const paymentEvents = (Array.isArray(payments) ? payments : []).map((payment) => ({ ...payment, eventId: payment.eventId || payment.paymentId, type: payment.type || "PAYMENT", observedAt: payment.observedAt || payment.paidAt, status: payment.status || "confirmed" }));
  const allEvents = [...paymentEvents, ...(Array.isArray(ledgerEvents) ? ledgerEvents : [])];
  const eventRows = Array.isArray(chainEvents) ? chainEvents : [];
  const signalRows = Array.isArray(publicSignals) ? publicSignals : [];
  const globalSeen = new Set();
  const duplicateIds = new Set();
  for (const event of allEvents) {
    const id = String(event.eventId || "");
    if (!id) continue;
    if (globalSeen.has(id)) duplicateIds.add(id);
    globalSeen.add(id);
  }

  const reconstructedAssets = assets.map((asset) => {
    const assetId = required(asset.assetId, "asset.assetId");
    const invoiceId = required(asset.invoiceId, "asset.invoiceId");
    const decimals = Number.isInteger(Number(asset.decimals ?? snapshot.decimals ?? 2)) ? Number(asset.decimals ?? snapshot.decimals ?? 2) : 2;
    if (decimals < 0 || decimals > 18) throw new Error(`${assetId}.decimals must be between 0 and 18.`);
    const currency = String(asset.currency || snapshot.currency || "USD").toUpperCase();
    const opening = toMinor(asset.outstanding, decimals, `${assetId}.outstanding`);
    const face = toMinor(asset.faceValue, decimals, `${assetId}.faceValue`);
    const conflicts = [];
    const excludedEvents = [];
    const appliedEvents = [];
    let paymentsApplied = 0n;
    let recoveriesApplied = 0n;
    let interestAccrued = 0n;
    let feesAccrued = 0n;
    let writeDowns = 0n;
    const related = allEvents.filter((event) => event.invoiceId === invoiceId || event.assetId === assetId);
    const seen = new Set();

    for (const event of related) {
      const eventId = String(event.eventId || "").trim();
      const eventAt = iso(event.observedAt || event.paidAt);
      const type = String(event.type || "PAYMENT").toUpperCase();
      if (!eventId) { conflicts.push({ code: "MISSING_EVENT_ID", detail: "A ledger event has no stable identifier." }); continue; }
      if (seen.has(eventId) || duplicateIds.has(eventId)) { conflicts.push({ code: "DUPLICATE_LEDGER_EVENT", detail: `${eventId} appeared more than once and was not applied.` }); continue; }
      seen.add(eventId);
      if (!eventAt) { conflicts.push({ code: "INVALID_EVENT_TIME", detail: `${eventId} has no valid observation timestamp.` }); continue; }
      if (Date.parse(eventAt) <= cutoffMs) { excludedEvents.push({ eventId, reason: "AT_OR_BEFORE_SNAPSHOT_CUTOFF" }); continue; }
      if (String(event.status || "confirmed").toLowerCase() !== "confirmed") { excludedEvents.push({ eventId, reason: "UNCONFIRMED" }); continue; }
      if (String(event.currency || currency).toUpperCase() !== currency) { conflicts.push({ code: "CURRENCY_MISMATCH", detail: `${eventId} is not denominated in ${currency}.` }); continue; }
      if ((type === "PAYMENT" || type === "RECOVERY") && !partyMatches(event.payer, asset.debtor)) { conflicts.push({ code: "PAYER_MISMATCH", detail: `${eventId} payer does not match the recorded debtor.` }); continue; }
      if ((type === "PAYMENT" || type === "RECOVERY") && !partyMatches(event.beneficiaryAccount, asset.bankAccount)) { conflicts.push({ code: "BENEFICIARY_MISMATCH", detail: `${eventId} beneficiary does not match the controlled collection account.` }); continue; }
      let amount;
      try { amount = toMinor(event.amount, decimals, eventId); } catch (error) { conflicts.push({ code: "INVALID_EVENT_AMOUNT", detail: error instanceof Error ? error.message : String(error) }); continue; }
      if (amount === 0n) { excludedEvents.push({ eventId, reason: "ZERO_AMOUNT" }); continue; }
      if (type === "PAYMENT") paymentsApplied += amount;
      else if (type === "RECOVERY") recoveriesApplied += amount;
      else if (type === "INTEREST") interestAccrued += amount;
      else if (type === "FEE") feesAccrued += amount;
      else if (type === "WRITE_DOWN") writeDowns += amount;
      else { conflicts.push({ code: "UNSUPPORTED_EVENT_TYPE", detail: `${eventId} uses unsupported type ${type}.` }); continue; }
      appliedEvents.push({ eventId, type, amountMinor: amount.toString(), observedAt: eventAt, source: event.source || "ledger" });
    }

    const credits = paymentsApplied + recoveriesApplied + writeDowns;
    const debits = interestAccrued + feesAccrued;
    const beforeFloor = opening + debits - credits;
    if (beforeFloor < 0n) conflicts.push({ code: "OVER_APPLIED_CREDITS", detail: `Confirmed credits exceed the reconstructed balance by ${fromMinor(-beforeFloor, decimals)} ${currency}.` });
    const closing = beforeFloor < 0n ? 0n : beforeFloor;
    const invariantDelta = opening + debits - credits - beforeFloor;
    if (invariantDelta !== 0n) conflicts.push({ code: "ACCOUNTING_INVARIANT_FAILED", detail: "Opening plus debits minus credits does not equal reconstructed closing balance." });
    if (asset.reportedClosing !== undefined) {
      const reportedClosing = toMinor(asset.reportedClosing, decimals, `${assetId}.reportedClosing`);
      if (reportedClosing !== closing) conflicts.push({ code: "REPORTED_CLOSING_MISMATCH", detail: `Reported closing ${fromMinor(reportedClosing, decimals)} differs from reconstructed ${fromMinor(closing, decimals)} ${currency}.` });
    }
    const assetChainEvents = eventRows.filter((event) => event.invoiceId === invoiceId || event.assetId === assetId);
    const assetSignals = signalRows.filter((signal) => signal.invoiceId === invoiceId || signal.assetId === assetId || signal.poolId === snapshot.poolId);
    const evidence = [
      { type: "last-trusted-snapshot", ref: asset.documentHash || assetId, observedAt: capturedAt },
      ...appliedEvents.map((event) => ({ type: "ledger-event", ref: event.eventId, observedAt: event.observedAt })),
      ...assetChainEvents.map((event) => ({ type: "onchain-event", ref: event.txHash || event.eventId || "event", observedAt: iso(event.observedAt || event.timestamp) })),
      ...assetSignals.map((signal) => ({ type: "independent-signal", ref: signal.source || signal.signalId || "signal", observedAt: iso(signal.observedAt || signal.timestamp) })),
    ];
    if (!appliedEvents.length && !assetChainEvents.length && !assetSignals.length && opening > 0n) conflicts.push({ code: "NO_POST_SNAPSHOT_EVIDENCE", detail: "No independent post-cutoff evidence was available for this open asset." });
    const independentTypes = new Set(evidence.map((item) => item.type));
    const confidence = conflicts.length ? "LOW" : independentTypes.has("onchain-event") && independentTypes.has("ledger-event") ? "HIGH" : evidence.length >= 2 ? "MEDIUM" : "LOW";
    return {
      assetId, invoiceId, debtor: asset.debtor, currency, decimals,
      status: conflicts.length ? "REVIEW" : closing === 0n ? "REPAID" : writeDowns > 0n ? "RESTRUCTURED" : "OUTSTANDING",
      openingOutstandingMinor: opening.toString(), faceValueMinor: face.toString(), paymentsAppliedMinor: paymentsApplied.toString(), recoveriesAppliedMinor: recoveriesApplied.toString(), interestAccruedMinor: interestAccrued.toString(), feesAccruedMinor: feesAccrued.toString(), writeDownsMinor: writeDowns.toString(), reconstructedOutstandingMinor: closing.toString(), accountingInvariantDeltaMinor: invariantDelta.toString(),
      openingOutstanding: asDisplayNumber(opening, decimals), paymentsApplied: asDisplayNumber(paymentsApplied, decimals), reconstructedOutstanding: asDisplayNumber(closing, decimals),
      confidence, appliedEvents, excludedEvents, evidence, conflicts,
      nextAction: conflicts.length ? "successor-review" : writeDowns > 0n ? "restructuring-approval" : "carry-forward-with-attestation",
    };
  });

  const conflictCount = reconstructedAssets.reduce((sum, asset) => sum + asset.conflicts.length, 0);
  const totalOutstanding = reconstructedAssets.reduce((sum, asset) => sum + asset.reconstructedOutstanding, 0);
  const highConfidence = reconstructedAssets.filter((asset) => asset.confidence === "HIGH").length;
  const state = conflictCount ? "REVIEW" : reconstructedAssets.every((asset) => asset.confidence !== "LOW") ? "RECONSTRUCTED" : "INSUFFICIENT_EVIDENCE";
  const artifact = {
    schema: "duevia.recovery-capsule/v1", accountingModel: "event-sourced-minor-units/v1",
    incidentId: incident.incidentId || `incident-${sha256({ capturedAt, poolId: snapshot.poolId }).slice(2, 18)}`,
    poolId: snapshot.poolId || "UNKNOWN_POOL", servicerId: incident.servicerId || snapshot.servicerId || "UNKNOWN_SERVICER",
    sourceSnapshot: { capturedAt, source: snapshot.source || "last-trusted-snapshot", snapshotHash: sha256(snapshot) },
    reconstructedAt: new Date().toISOString(), state,
    totals: { assetCount: reconstructedAssets.length, reconstructedOutstanding: Number(totalOutstanding.toFixed(2)), conflictCount, highConfidenceAssets: highConfidence },
    assets: reconstructedAssets,
    independentEvidence: { chainEvents: eventRows.length, publicSignals: signalRows.length, ledgerEventsReceived: allEvents.length, ledgerEventsApplied: reconstructedAssets.reduce((sum, asset) => sum + asset.appliedEvents.length, 0) },
    requiredApprovals: conflictCount ? ["successor-servicer", "governance"] : ["successor-servicer"],
  };
  return { ...artifact, recoveryRoot: sha256({ ...artifact, reconstructedAt: null }) };
}
