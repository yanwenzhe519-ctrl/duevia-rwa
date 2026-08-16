import { createHash } from "node:crypto";

const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const iso = (value) => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return `0x${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

/**
 * Rebuilds a portable recovery capsule from the last trusted snapshot and
 * independent observations. The result is deterministic and deliberately
 * separates observed facts from AI-assisted inferences.
 */
export function reconstructAssetState({ snapshot = {}, payments = [], chainEvents = [], publicSignals = [], incident = {} } = {}) {
  const assets = Array.isArray(snapshot.assets) ? snapshot.assets : [];
  const observedAt = iso(snapshot.capturedAt) || new Date().toISOString();
  const paymentRows = Array.isArray(payments) ? payments : [];
  const eventRows = Array.isArray(chainEvents) ? chainEvents : [];
  const signalRows = Array.isArray(publicSignals) ? publicSignals : [];
  const validPayments = paymentRows.filter((payment) => asNumber(payment.amount) >= 0 && payment.invoiceId);
  const paymentsByInvoice = new Map();
  for (const payment of validPayments) paymentsByInvoice.set(payment.invoiceId, [...(paymentsByInvoice.get(payment.invoiceId) || []), payment]);

  const reconstructedAssets = assets.map((asset) => {
    const relatedPayments = paymentsByInvoice.get(asset.invoiceId) || [];
    const paid = relatedPayments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
    const outstanding = Math.max(0, asNumber(asset.outstanding) - paid);
    const expectedFromFace = Math.max(0, asNumber(asset.faceValue) - paid);
    const balanceConflict = Math.abs(outstanding - expectedFromFace) > 0.01;
    const assetEvents = eventRows.filter((event) => event.invoiceId === asset.invoiceId || event.assetId === asset.assetId);
    const assetSignals = signalRows.filter((signal) => signal.invoiceId === asset.invoiceId || signal.assetId === asset.assetId);
    const evidence = [
      { type: "last-trusted-snapshot", ref: asset.documentHash || asset.assetId, observedAt },
      ...relatedPayments.map((payment) => ({ type: "payment", ref: payment.paymentId || payment.invoiceId, observedAt: iso(payment.paidAt) })),
      ...assetEvents.map((event) => ({ type: "onchain-event", ref: event.txHash || event.eventId || "event", observedAt: iso(event.observedAt || event.timestamp) })),
      ...assetSignals.map((signal) => ({ type: "independent-signal", ref: signal.source || signal.signalId || "signal", observedAt: iso(signal.observedAt || signal.timestamp) })),
    ];
    const conflicts = [];
    if (balanceConflict) conflicts.push({ code: "BALANCE_CONFLICT", detail: `Snapshot outstanding ${asNumber(asset.outstanding).toFixed(2)} differs from reconstructed ${expectedFromFace.toFixed(2)}.` });
    if (!relatedPayments.length && asNumber(asset.outstanding) > 0) conflicts.push({ code: "NO_POST_SNAPSHOT_PAYMENT_EVIDENCE", detail: "No independently observed payment was available after the last trusted snapshot." });
    const confidence = conflicts.length ? "LOW" : evidence.length >= 2 ? "MEDIUM" : "LOW";
    return {
      assetId: asset.assetId,
      invoiceId: asset.invoiceId,
      debtor: asset.debtor,
      status: balanceConflict ? "REVIEW" : asset.status === "repaid" || outstanding === 0 ? "REPAID" : "OUTSTANDING",
      reconstructedOutstanding: Number(outstanding.toFixed(2)),
      paymentsApplied: Number(paid.toFixed(2)),
      confidence,
      evidence,
      conflicts,
      nextAction: conflicts.length ? "successor-review" : "carry-forward-with-attestation",
    };
  });

  const conflictCount = reconstructedAssets.reduce((sum, asset) => sum + asset.conflicts.length, 0);
  const totalOutstanding = reconstructedAssets.reduce((sum, asset) => sum + asset.reconstructedOutstanding, 0);
  const highConfidence = reconstructedAssets.filter((asset) => asset.confidence !== "LOW").length;
  const state = conflictCount > 0 ? "REVIEW" : reconstructedAssets.length && highConfidence === reconstructedAssets.length ? "RECONSTRUCTED" : "INSUFFICIENT_EVIDENCE";
  const artifact = {
    schema: "duevia.recovery-capsule/v1",
    incidentId: incident.incidentId || `incident-${sha256({ observedAt, poolId: snapshot.poolId }).slice(2, 18)}`,
    poolId: snapshot.poolId || "UNKNOWN_POOL",
    servicerId: incident.servicerId || snapshot.servicerId || "UNKNOWN_SERVICER",
    sourceSnapshot: { capturedAt: observedAt, source: snapshot.source || "last-trusted-snapshot", snapshotHash: sha256(snapshot) },
    reconstructedAt: new Date().toISOString(),
    state,
    totals: { assetCount: reconstructedAssets.length, reconstructedOutstanding: Number(totalOutstanding.toFixed(2)), conflictCount, highConfidenceAssets: highConfidence },
    assets: reconstructedAssets,
    independentEvidence: { chainEvents: eventRows.length, publicSignals: signalRows.length, paymentsApplied: validPayments.length },
    requiredApprovals: conflictCount ? ["successor-servicer", "governance"] : ["successor-servicer"],
  };
  const recoveryRoot = sha256({ ...artifact, reconstructedAt: undefined });
  return { ...artifact, recoveryRoot };
}
