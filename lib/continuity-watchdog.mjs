import { createHash } from "node:crypto";

const hours = (milliseconds) => milliseconds / 3_600_000;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);

export function evaluateWatchdog(observation, now = new Date().toISOString()) {
  if (!observation || typeof observation !== "object") throw new Error("Watchdog observation is required.");
  const servicerId = String(observation.servicerId || "").trim();
  const poolId = String(observation.poolId || "").trim();
  if (!servicerId || !poolId) throw new Error("servicerId and poolId are required.");
  const nowMs = Date.parse(now);
  const heartbeatMs = Date.parse(observation.lastHeartbeatAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(heartbeatMs)) throw new Error("Watchdog timestamps must be valid ISO values.");
  const slaHours = Number(observation.slaHours || 24);
  const graceHours = Number(observation.graceHours || 6);
  if (!Number.isFinite(slaHours) || slaHours <= 0 || !Number.isFinite(graceHours) || graceHours < 0) throw new Error("Watchdog SLA values are invalid.");
  const ageHours = Math.max(0, hours(nowMs - heartbeatMs));
  const signals = Array.isArray(observation.signals) ? observation.signals : [];
  const invalidSignature = signals.some((signal) => signal.type === "signature" && signal.valid === false);
  const uniqueFailures = (type) => new Set(signals.filter((signal) => signal.type === type && signal.ok === false).map((signal) => signal.source).filter(Boolean)).size;
  const failedEndpoints = uniqueFailures("endpoint");
  const failedPayments = uniqueFailures("redemption");
  const chainFailures = uniqueFailures("chain");
  const intelligenceSources = new Set(signals.filter((signal) => signal.type === "public-intelligence" && Number(signal.riskArticleCount) > 0).map((signal) => signal.source).filter(Boolean));
  const heartbeatBreached = ageHours > slaHours;
  const heartbeatExpired = ageHours > slaHours + graceHours;
  const sourceIds = new Set(signals.map((signal) => signal.source).filter(Boolean));
  if (heartbeatBreached) sourceIds.add(`heartbeat:${servicerId}`);
  const confidenceScore = Math.min(100, (heartbeatExpired ? 55 : heartbeatBreached ? 25 : 0) + Math.min(70, failedEndpoints * 35) + Math.min(70, failedPayments * 35) + Math.min(40, chainFailures * 20) + Math.min(20, intelligenceSources.size * 10) + (invalidSignature ? 100 : 0));
  const critical = invalidSignature;
  let state = "HEALTHY";
  const reasons = [];
  if (invalidSignature) { state = "INVALID_SIGNATURE"; reasons.push("A signed servicing observation failed verification."); }
  else if (confidenceScore >= 70 && sourceIds.size >= 2) {
    state = "OUTAGE";
    if (heartbeatExpired) reasons.push(`Heartbeat exceeded SLA plus grace by ${(ageHours - slaHours - graceHours).toFixed(1)} hours.`);
    if (failedEndpoints >= 2) reasons.push(`${failedEndpoints} independent endpoint checks failed.`);
    if (failedPayments >= 2) reasons.push(`${failedPayments} redemption or payment checks failed.`);
  } else if (heartbeatBreached || failedEndpoints || failedPayments || chainFailures || intelligenceSources.size) {
    state = "DEGRADED";
    reasons.push(heartbeatBreached ? (heartbeatExpired ? "Heartbeat expired but lacks independent corroboration." : "Heartbeat SLA breached but remains inside the grace window.") : "Independent risk evidence has not reached the suspension threshold.");
  }
  const incidentId = state === "OUTAGE" || state === "INVALID_SIGNATURE" ? `duevia-${hash({ servicerId, poolId, firstMissedAt: observation.lastHeartbeatAt })}` : null;
  return { servicerId, poolId, state, incidentId, evaluatedAt: new Date(nowMs).toISOString(), lastHeartbeatAt: new Date(heartbeatMs).toISOString(), ageHours: Number(ageHours.toFixed(2)), slaHours, graceHours, affectedPools: [poolId], reasons, evidenceSignals: signals.length, independentSources: sourceIds.size, confidenceScore, critical, shouldSuspend: state === "OUTAGE" || state === "INVALID_SIGNATURE" };
}
