import test from "node:test";
import assert from "node:assert/strict";
import { evaluateWatchdog } from "../lib/continuity-watchdog.mjs";
import { monitoredTopics, scanXLayer } from "../lib/xlayer-scanner.mjs";
import { searchPublicIntelligence } from "../lib/public-intelligence.mjs";

const base = { servicerId: "SERVICER-1", poolId: "POOL-1", lastHeartbeatAt: "2026-08-16T00:00:00.000Z", slaHours: 24, graceHours: 6, signals: [] };

test("watchdog distinguishes healthy, grace, and outage states", () => {
  assert.equal(evaluateWatchdog(base, "2026-08-16T12:00:00.000Z").state, "HEALTHY");
  assert.equal(evaluateWatchdog(base, "2026-08-17T02:00:00.000Z").state, "DEGRADED");
  const outage = evaluateWatchdog({ ...base, signals: [{ type: "endpoint", source: "independent-observer", ok: false }] }, "2026-08-17T07:00:00.000Z");
  assert.equal(outage.state, "OUTAGE");
  assert.equal(outage.shouldSuspend, true);
  assert.match(outage.incidentId, /^duevia-[0-9a-f]{24}$/);
});

test("two independent endpoint failures trigger an outage without servicer cooperation", () => {
  const outage = evaluateWatchdog({ ...base, signals: [{ type: "endpoint", source: "observer-a", ok: false }, { type: "endpoint", source: "observer-b", ok: false }] }, "2026-08-16T12:00:00.000Z");
  assert.equal(outage.state, "OUTAGE");
  assert.equal(outage.evidenceSignals, 2);
});

test("scanner reads X Layer logs by protocol event signature across addresses", async () => {
  const topic = Object.keys(monitoredTopics).find((value) => monitoredTopics[value].name === "DepositAccepted");
  const fetchImpl = async (_url, init) => {
    const request = JSON.parse(init.body);
    if (request.method === "eth_blockNumber") return { ok: true, json: async () => ({ result: "0x64" }) };
    assert.equal(request.method, "eth_getLogs");
    assert.equal(typeof request.params[0].topics[0], "string");
    const result = request.params[0].topics[0] === topic ? [{ address: "0xe68b0c11cad7f756a536391ff3632e8956bbcc95", blockNumber: "0x63", transactionHash: `0x${"1".repeat(64)}`, logIndex: "0x0", topics: [topic, `0x${"0".repeat(24)}05667de34ad47bafe8a8b976c19809cadf7719d2`, `0x${"2".repeat(64)}`], data: `0x${"0".repeat(63)}1` }] : [];
    return { ok: true, json: async () => ({ result }) };
  };
  const result = await scanXLayer({ fromBlock: 90, fetchImpl });
  assert.equal(result.chainId, 1952);
  assert.equal(result.observationCount, 1);
  assert.equal(result.observations[0].event, "DepositAccepted");
});

test("public intelligence marks independently reported default signals", async () => {
  const result = await searchPublicIntelligence({ query: "Example Servicer", fetchImpl: async () => ({ ok: true, json: async () => ({ articles: [{ title: "Example Servicer missed payment and faces default", url: "https://news.example/a", domain: "news.example", seendate: "20260816T120000Z", language: "English" }] }) }) });
  assert.equal(result.source, "gdelt-doc-v2");
  assert.equal(result.riskArticleCount, 1);
  assert.deepEqual(result.articles[0].matchedRisks, ["default", "missed payment"]);
});
