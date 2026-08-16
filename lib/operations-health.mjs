export function evaluateOperationsHealth({ now = new Date().toISOString(), runs = [], lease = null, scanner = null, enabledProjects = 0, cadenceMinutes = 5 } = {}) {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error("Operations health timestamp is invalid.");
  const latest = runs[0] || null;
  const latestMs = latest ? Date.parse(latest.finished_at || latest.finishedAt) : NaN;
  const ageMinutes = Number.isFinite(latestMs) ? Math.max(0, (nowMs - latestMs) / 60_000) : Infinity;
  const recentErrors = runs.filter((run) => run.status === "error").length;
  const consecutiveErrors = runs.findIndex((run) => run.status !== "error");
  const consecutiveErrorCount = consecutiveErrors === -1 ? runs.length : consecutiveErrors;
  const successfulSources = new Set(runs.filter((run) => run.status === "ok").map((run) => run.trigger_source || run.triggerSource).filter((source) => source && source !== "legacy"));
  const leaseUntilMs = lease ? Date.parse(lease.lease_until || lease.leaseUntil) : NaN;
  const leaseExpired = !Number.isFinite(leaseUntilMs) || leaseUntilMs <= nowMs;
  const scannerUpdatedMs = scanner ? Date.parse(scanner.updated_at || scanner.updatedAt) : NaN;
  const scannerAgeMinutes = Number.isFinite(scannerUpdatedMs) ? Math.max(0, (nowMs - scannerUpdatedMs) / 60_000) : Infinity;

  let status = "HEALTHY";
  const reasons = [];
  if (!latest || ageMinutes > cadenceMinutes * 4 || consecutiveErrorCount >= 3) {
    status = "OUTAGE";
    if (!latest) reasons.push("No Keeper run has been recorded.");
    if (latest && ageMinutes > cadenceMinutes * 4) reasons.push(`Latest Keeper completion is ${ageMinutes.toFixed(1)} minutes old.`);
    if (consecutiveErrorCount >= 3) reasons.push(`${consecutiveErrorCount} consecutive Keeper runs failed.`);
  } else if (ageMinutes > cadenceMinutes * 2 || latest.status !== "ok" || scannerAgeMinutes > cadenceMinutes * 4) {
    status = "DEGRADED";
    if (ageMinutes > cadenceMinutes * 2) reasons.push("Keeper cadence SLO is breached.");
    if (latest.status !== "ok") reasons.push("The latest Keeper run failed.");
    if (scannerAgeMinutes > cadenceMinutes * 4) reasons.push("X Layer scan cursor is stale.");
  }
  return {
    status,
    evaluatedAt: new Date(nowMs).toISOString(),
    cadenceMinutes,
    latestRunAt: latest && Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : null,
    latestRunAgeMinutes: Number.isFinite(ageMinutes) ? Number(ageMinutes.toFixed(2)) : null,
    recentErrors,
    consecutiveErrors: consecutiveErrorCount,
    scannerAgeMinutes: Number.isFinite(scannerAgeMinutes) ? Number(scannerAgeMinutes.toFixed(2)) : null,
    lease: { active: !leaseExpired, holderPresent: Boolean(lease?.holder) },
    enabledProjects: Number(enabledProjects || 0),
    failover: { status: successfulSources.size >= 2 ? "VERIFIED" : "UNPROVEN", successfulSources: successfulSources.size },
    reasons,
  };
}
