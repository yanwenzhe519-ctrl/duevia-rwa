import { evaluateWatchdog } from "./continuity-watchdog.mjs";

export function evaluateProjectRun(project, signals, now, lastHeartbeatAt = project.last_heartbeat_at) {
  const evaluation = evaluateWatchdog({ servicerId: project.servicer_id, poolId: project.pool_id, lastHeartbeatAt, slaHours: project.sla_hours, graceHours: project.grace_hours, signals }, now);
  const previousRuns = Number(project.consecutive_outage_runs || 0);
  const consecutiveOutageRuns = evaluation.shouldSuspend ? previousRuns + 1 : 0;
  const confirmedSuspension = evaluation.critical || consecutiveOutageRuns >= 2;
  const shadowMode = Boolean(Number(project.shadow_mode ?? 1));
  return { evaluation, consecutiveOutageRuns, confirmedSuspension, shadowMode, persistedIncidentState: confirmedSuspension && evaluation.incidentId ? (shadowMode ? `SHADOW_${evaluation.state}` : evaluation.state) : null };
}

export function executionPolicy({ confirmedSuspension, shadowMode, automaticSuspension, coordinatorAddress, aiValidated, recoveryRoot }) {
  const gates = { confirmedSuspension: Boolean(confirmedSuspension), shadowModeDisabled: !shadowMode, automaticSuspensionEnabled: Boolean(automaticSuspension), coordinatorConfigured: /^0x[0-9a-fA-F]{40}$/.test(String(coordinatorAddress || "")), aiValidated: Boolean(aiValidated), recoveryRootValid: /^0x[0-9a-fA-F]{64}$/.test(String(recoveryRoot || "")) };
  return { ready: Object.values(gates).every(Boolean), gates };
}

