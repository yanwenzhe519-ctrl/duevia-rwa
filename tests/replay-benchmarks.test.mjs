import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runBenchmarkScenario } from "../scripts/run-replay-benchmarks.mjs";

for (const file of ["examples/replays/maple-orthogonal.json", "examples/replays/tugende.json"]) {
  test(`historical replay benchmark: ${file}`, () => {
    const result = runBenchmarkScenario(JSON.parse(fs.readFileSync(file, "utf8")));
    assert.equal(result.finalState, "OUTAGE");
    assert.equal(result.falsePositiveCount, 0);
    assert.ok(result.detectionLatencyHours >= 0 && result.detectionLatencyHours <= 48);
    assert.equal(result.reconstructionAbsoluteError, 0);
    assert.match(result.recoveryRoot, /^0x[0-9a-f]{64}$/);
  });
}

