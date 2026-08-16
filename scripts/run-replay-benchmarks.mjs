import fs from "node:fs";
import { replayIncident } from "../lib/incident-replay.mjs";

export function runBenchmarkScenario(scenario) {
  const replay = replayIncident(scenario);
  const firstSuspend = replay.states.find((state) => state.shouldSuspend);
  const failureMs = Date.parse(scenario.failureStartedAt);
  const detectionLatencyHours = firstSuspend ? (Date.parse(firstSuspend.at) - failureMs) / 3_600_000 : null;
  const falsePositiveCount = replay.states.filter((state) => Date.parse(state.at) < failureMs && state.shouldSuspend).length;
  const reconstructedOutstanding = replay.recoveryCapsule?.totals.reconstructedOutstanding ?? null;
  const reconstructionAbsoluteError = reconstructedOutstanding == null ? null : Math.abs(reconstructedOutstanding - scenario.expectedOutstanding);
  return { name: scenario.name, finalState: replay.finalState, detectionLatencyHours, falsePositiveCount, reconstructedOutstanding, expectedOutstanding: scenario.expectedOutstanding, reconstructionAbsoluteError, capsuleState: replay.recoveryCapsule?.state || null, recoveryRoot: replay.recoveryCapsule?.recoveryRoot || null };
}

if (process.argv[1]?.endsWith("run-replay-benchmarks.mjs")) {
  const files = ["examples/replays/maple-orthogonal.json", "examples/replays/tugende.json"];
  const results = files.map((file) => runBenchmarkScenario(JSON.parse(fs.readFileSync(file, "utf8"))));
  console.log(JSON.stringify({ schema: "duevia.replay-benchmark/v1", generatedAt: new Date().toISOString(), results }, null, 2));
}

