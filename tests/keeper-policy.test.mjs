import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProjectRun, executionPolicy } from "../lib/keeper-policy.mjs";

const project = { servicer_id: "S", pool_id: "P", last_heartbeat_at: "2026-08-14T00:00:00.000Z", sla_hours: 24, grace_hours: 6, consecutive_outage_runs: 0, shadow_mode: 1 };
const signals = [{ type: "endpoint", source: "observer-a", ok: false }, { type: "endpoint", source: "observer-b", ok: false }];

test("ordinary outage requires two consecutive keeper runs", () => {
  const first = evaluateProjectRun(project, signals, "2026-08-15T12:00:00.000Z");
  assert.equal(first.evaluation.state, "OUTAGE");
  assert.equal(first.confirmedSuspension, false);
  assert.equal(first.persistedIncidentState, null);
  const second = evaluateProjectRun({ ...project, consecutive_outage_runs: 1 }, signals, "2026-08-15T12:05:00.000Z");
  assert.equal(second.confirmedSuspension, true);
  assert.equal(second.persistedIncidentState, "SHADOW_OUTAGE");
});

test("critical signature failure bypasses confirmation window but remains in shadow mode", () => {
  const result = evaluateProjectRun(project, [{ type: "signature", source: "signed-feed", valid: false }], "2026-08-14T01:00:00.000Z");
  assert.equal(result.confirmedSuspension, true);
  assert.equal(result.persistedIncidentState, "SHADOW_INVALID_SIGNATURE");
});

test("execution queue requires every safety gate", () => {
  const ready = executionPolicy({ confirmedSuspension: true, shadowMode: false, automaticSuspension: true, coordinatorAddress: `0x${"1".repeat(40)}`, aiValidated: true, recoveryRoot: `0x${"2".repeat(64)}` });
  assert.equal(ready.ready, true);
  assert.equal(executionPolicy({ ...ready.gates, confirmedSuspension: true }).ready, false);
});

