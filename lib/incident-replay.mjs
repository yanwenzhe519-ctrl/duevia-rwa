import { evaluateWatchdog } from "./continuity-watchdog.mjs";
import { reconstructAssetState } from "./reconstruction-engine.mjs";

export function replayIncident({ servicerId, poolId, snapshot, timeline = [], slaHours = 24, graceHours = 6 } = {}) {
  if (!snapshot || !Array.isArray(timeline)) throw new Error("Replay requires a baseline snapshot and timeline.");
  const ordered = [...timeline].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const states = [];
  const payments = [];
  const chainEvents = [];
  const publicSignals = [];
  let lastHeartbeatAt = snapshot.capturedAt;
  let capsule = null;
  for (const step of ordered) {
    if (step.heartbeatAt) lastHeartbeatAt = step.heartbeatAt;
    if (Array.isArray(step.payments)) payments.push(...step.payments);
    if (Array.isArray(step.chainEvents)) chainEvents.push(...step.chainEvents);
    if (Array.isArray(step.publicSignals)) publicSignals.push(...step.publicSignals);
    const incident = evaluateWatchdog({ servicerId, poolId, lastHeartbeatAt, slaHours, graceHours, signals: step.signals || [] }, step.at);
    states.push({ at: step.at, state: incident.state, shouldSuspend: incident.shouldSuspend, reasons: incident.reasons });
    if (incident.shouldSuspend) capsule = reconstructAssetState({ snapshot, payments, chainEvents, publicSignals, incident });
  }
  return { schema: "duevia.incident-replay/v1", servicerId, poolId, states, finalState: states.at(-1)?.state || "UNKNOWN", recoveryCapsule: capsule };
}

