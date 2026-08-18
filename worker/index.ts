/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { evaluateWatchdog } from "../lib/continuity-watchdog.mjs";
import { scanXLayer } from "../lib/xlayer-scanner.mjs";
import { keccak256, stringToHex, verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { searchPublicIntelligence } from "../lib/public-intelligence.mjs";
import { collectEvidenceIds, failedInvestigation, modelResponseObject, validateInvestigation, validateModelVerifier } from "../lib/ai-investigation.mjs";
import { reconstructAssetState } from "../lib/reconstruction-engine.mjs";
import { evaluateProjectRun, executionPolicy } from "../lib/keeper-policy.mjs";
import { normalizeObserverEndpoints, normalizePublicEndpoint, parseObserverStatus, verifyObserverStatus } from "../lib/observer-adapter.mjs";
import { evaluateOperationsHealth } from "../lib/operations-health.mjs";
import { parseServicerFeed, servicerFeedStatus } from "../lib/servicer-feed.mjs";
import { verifyServicerFeedSignature } from "../lib/servicer-feed-security.mjs";
import { analyzePortfolio } from "../lib/portfolio-engine.mjs";
import { dueviaContracts, dueviaGovernanceTransactions, dueviaProject, dueviaRelease, legacyRehearsalTransactions } from "../lib/deployment-evidence";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  WATCHDOG_DB: D1Database;
  XLAYER_RPC_URL?: string;
  WATCHDOG_ADMIN_TOKEN?: string;
  WATCHDOG_OBSERVER_ADDRESSES?: string;
  DUEVIA_OBSERVER_PRIVATE_KEY?: `0x${string}`;
  DUEVIA_GIT_COMMIT?: string;
  DUEVIA_DEPLOYED_AT?: string;
  DUEVIA_RELEASE?: string;
  CF_VERSION_METADATA?: { id?: string; tag?: string; timestamp?: string };
  SERVICER_FEED_HMAC_SECRET?: string;
  AI: { run(model: string, input: Record<string, unknown>): Promise<Record<string, unknown>> };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

async function persistObservation(db: D1Database, observation: Record<string, unknown>) {
  await db.prepare("INSERT OR IGNORE INTO observations (observation_id, pool_id, source, kind, observed_at, block_number, transaction_hash, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(String(observation.observationId), observation.poolId ? String(observation.poolId) : null, String(observation.source || "unknown"), String(observation.event || observation.kind || "observation"), new Date().toISOString(), observation.blockNumber ? String(observation.blockNumber) : null, observation.transactionHash ? String(observation.transactionHash) : null, JSON.stringify(observation)).run();
}

async function observerStatusApi(request: Request, env: Env) {
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  if (!env.DUEVIA_OBSERVER_PRIVATE_KEY || !/^0x[0-9a-fA-F]{64}$/.test(env.DUEVIA_OBSERVER_PRIVATE_KEY)) {
    return Response.json({ ok: false, error: "Continuous observer signing key is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const poolId = new URL(request.url).searchParams.get("poolId")?.trim() || "";
  if (!poolId) return Response.json({ ok: false, error: "poolId query parameter is required." }, { status: 400 });
  const project = await env.WATCHDOG_DB.prepare("SELECT pool_id, last_state, last_heartbeat_at, consecutive_outage_runs FROM projects WHERE pool_id = ? AND enabled = 1").bind(poolId).first<Record<string, unknown>>();
  if (!project) return Response.json({ ok: false, error: "Registered project not found." }, { status: 404 });
  const observedAt = new Date().toISOString();
  const state = String(project.last_state || "HEALTHY").toUpperCase();
  const status = state.includes("OUTAGE") || state.includes("SUSPENDED") ? "OUTAGE" : state.includes("DEGRADED") || Number(project.consecutive_outage_runs || 0) > 0 ? "DEGRADED" : "HEALTHY";
  const evidenceHash = keccak256(stringToHex(JSON.stringify({ poolId, state, lastHeartbeatAt: project.last_heartbeat_at || null, consecutiveOutageRuns: Number(project.consecutive_outage_runs || 0) })));
  const nonce = `observer:${Date.now()}:${crypto.randomUUID()}`;
  const account = privateKeyToAccount(env.DUEVIA_OBSERVER_PRIVATE_KEY);
  const message = `Duevia observer status\n${poolId}\n${observedAt}\n${status}\n${evidenceHash}\n${nonce}`;
  const signature = await account.signMessage({ message });
  await persistObservation(env.WATCHDOG_DB, { observationId: `service-observer:${poolId}:${nonce}`, poolId, source: `observer:${account.address.toLowerCase()}`, event: "ContinuousObserverStatus", observedAt, status, evidenceHash, nonce });
  return Response.json({ ok: true, schema: "duevia.observer-status/v1", poolId, observer: account.address.toLowerCase(), observedAt, status, evidenceHash, nonce, signature }, { headers: { "Cache-Control": "no-store" } });
}

async function runKeeper(env: Env, triggerSource = "cloudflare-cron-primary") {
  const startedAt = new Date().toISOString();
  const holder = crypto.randomUUID();
  const leaseUntil = new Date(Date.parse(startedAt) + 4 * 60_000).toISOString();
  const lease = await env.WATCHDOG_DB.prepare("UPDATE keeper_leases SET holder = ?, lease_until = ?, updated_at = ? WHERE lease_id = 'xlayer-1952' AND lease_until < ?")
    .bind(holder, leaseUntil, startedAt, startedAt).run();
  if (!lease.meta.changes) return { skipped: true, reason: "keeper-lease-held", triggerSource, observationCount: 0 };
  try {
    return { ...await runKeeperOnce(env, startedAt, triggerSource, holder), triggerSource };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await env.WATCHDOG_DB.prepare("INSERT INTO keeper_runs (run_id, started_at, finished_at, from_block, to_block, observations, status, error, trigger_source, lease_holder) VALUES (?, ?, ?, 'unknown', 'unknown', 0, 'error', ?, ?, ?)")
      .bind(`keeper-error-${Date.now()}`, startedAt, finishedAt, error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000), triggerSource, holder).run();
    throw error;
  } finally {
    const releasedAt = new Date().toISOString();
    await env.WATCHDOG_DB.prepare("UPDATE keeper_leases SET holder = NULL, lease_until = ?, updated_at = ? WHERE lease_id = 'xlayer-1952' AND holder = ?")
      .bind(releasedAt, releasedAt, holder).run();
  }
}

async function runKeeperOnce(env: Env, startedAt: string, triggerSource: string, holder: string) {
  const cursor = await env.WATCHDOG_DB.prepare("SELECT last_scanned_block FROM scanner_state WHERE chain_id = 1952").first<{ last_scanned_block: string }>();
  const scan = await scanXLayer({ rpcUrl: env.XLAYER_RPC_URL || "https://testrpc.xlayer.tech", fromBlock: cursor ? BigInt(cursor.last_scanned_block) + 1n : undefined });
  if (scan.skippedFromBlock) {
    await persistObservation(env.WATCHDOG_DB, { observationId: `scanner-gap:${startedAt}`, poolId: "DUEVIA-SYSTEM", source: "xlayer-rpc", event: "ScannerRangeTruncated", fromBlock: scan.skippedFromBlock, toBlock: scan.fromBlock, latestBlock: scan.latestBlock });
  }
  for (const observation of scan.observations) await persistObservation(env.WATCHDOG_DB, observation);
  const projects = await env.WATCHDOG_DB.prepare("SELECT * FROM projects WHERE enabled = 1").all<Record<string, unknown>>();
  for (const project of projects.results) {
    const signals: Array<Record<string, unknown>> = [];
    const contractActivity = scan.observations.some((observation) => String(observation.address).toLowerCase() === String(project.contract_address || "").toLowerCase());
    let lastHeartbeatAt = contractActivity ? startedAt : String(project.last_heartbeat_at);
    const allowedObservers = new Set((env.WATCHDOG_OBSERVER_ADDRESSES || "").toLowerCase().split(",").map((value) => value.trim()).filter(Boolean));
    let observerEndpoints: string[] = [];
    try { observerEndpoints = normalizeObserverEndpoints(JSON.parse(String(project.observer_endpoints_json || "[]"))); } catch {
      await persistObservation(env.WATCHDOG_DB, { observationId: `adapter-config:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: "observer-adapter", event: "AdapterConfigurationError" });
    }
    for (const endpoint of observerEndpoints) {
      let endpointSource = "endpoint:invalid";
      try { endpointSource = `endpoint:${new URL(endpoint).host}`; } catch { /* Normalization already rejects invalid URLs. */ }
      try {
        const response = await fetch(endpoint, { method: "GET", headers: { Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(8_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.text();
        if (raw.length > 65_536) throw new Error("Observer response exceeds 64 KB");
        const envelope = parseObserverStatus(JSON.parse(raw), String(project.pool_id), startedAt);
        const signal = await verifyObserverStatus(envelope, allowedObservers, verifyMessage);
        const observationId = `observer-adapter:${envelope.observer}:${envelope.nonce}`;
        const replay = await env.WATCHDOG_DB.prepare("SELECT observation_id FROM observations WHERE observation_id = ?").bind(observationId).first();
        if (replay) {
          await persistObservation(env.WATCHDOG_DB, { observationId: `observer-replay:${project.pool_id}:${Date.now()}:${envelope.observer}`, poolId: project.pool_id, source: signal.source, event: "ObserverReplayRejected", nonce: envelope.nonce });
          continue;
        }
        signals.push(signal);
        if (signal.ok && Date.parse(signal.observedAt) > Date.parse(lastHeartbeatAt)) lastHeartbeatAt = signal.observedAt;
        await persistObservation(env.WATCHDOG_DB, { observationId, poolId: project.pool_id, source: signal.source, event: "ObserverStatus", status: signal.status, observedAt: signal.observedAt, evidenceHash: signal.evidenceHash });
      } catch (error) {
        signals.push({ type: "endpoint", source: endpointSource, ok: false });
        await persistObservation(env.WATCHDOG_DB, { observationId: `adapter-error:${project.pool_id}:${Date.now()}:${endpointSource}`, poolId: project.pool_id, source: endpointSource, event: "ObserverAdapterError", error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (project.public_endpoint) {
      let ok = false;
      let status = 0;
      let endpointSource = "endpoint:invalid";
      let endpoint: string | null = null;
      try {
        endpoint = normalizePublicEndpoint(project.public_endpoint);
        endpointSource = `endpoint:${new URL(String(endpoint)).host}`;
        const response = await fetch(String(endpoint), { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(8_000) });
        ok = response.ok;
        status = response.status;
      } catch (error) {
        await persistObservation(env.WATCHDOG_DB, { observationId: `endpoint-error:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: endpointSource, event: "EndpointCheckError", error: error instanceof Error ? error.message : String(error) });
      }
      await persistObservation(env.WATCHDOG_DB, { observationId: `endpoint:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: "independent-endpoint", event: "EndpointCheck", ok, status, endpoint });
      signals.push({ type: "endpoint", source: endpointSource, ok, status });
    }
    if (project.intelligence_query) {
      try {
        const intelligence = await searchPublicIntelligence({ query: String(project.intelligence_query) });
        await persistObservation(env.WATCHDOG_DB, { observationId: `intelligence:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: intelligence.source, event: "PublicIntelligence", ...intelligence });
        signals.push({ type: "public-intelligence", source: intelligence.source, ok: intelligence.riskArticleCount === 0, riskArticleCount: intelligence.riskArticleCount });
      } catch { /* Public intelligence is one independent source and must not stop chain scanning. */ }
    }
    const { evaluation, consecutiveOutageRuns, confirmedSuspension, shadowMode, persistedIncidentState } = evaluateProjectRun(project, signals, startedAt, lastHeartbeatAt);
    const evaluationId = `evaluation:${project.pool_id}:${Date.now()}`;
    await env.WATCHDOG_DB.batch([
      env.WATCHDOG_DB.prepare("INSERT INTO incident_evaluations (evaluation_id, pool_id, evaluated_at, state, should_suspend, consecutive_outage_runs, shadow_mode, evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(evaluationId, project.pool_id, startedAt, evaluation.state, confirmedSuspension ? 1 : 0, consecutiveOutageRuns, Number(project.shadow_mode ?? 1), JSON.stringify({ ...evaluation, confirmedSuspension })),
      env.WATCHDOG_DB.prepare("UPDATE projects SET last_heartbeat_at = ?, last_state = ?, consecutive_outage_runs = ?, updated_at = ? WHERE pool_id = ?").bind(lastHeartbeatAt, evaluation.state, consecutiveOutageRuns, startedAt, project.pool_id),
    ]);
    if (evaluation.incidentId && confirmedSuspension && persistedIncidentState) {
      await env.WATCHDOG_DB.prepare("INSERT INTO incidents (incident_id, pool_id, servicer_id, state, opened_at, updated_at, recovery_root, evidence_json) VALUES (?, ?, ?, ?, ?, ?, NULL, ?) ON CONFLICT(incident_id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at, evidence_json=excluded.evidence_json")
        .bind(evaluation.incidentId, evaluation.poolId, evaluation.servicerId, persistedIncidentState, startedAt, startedAt, JSON.stringify({ ...evaluation, consecutiveOutageRuns, confirmedSuspension, shadowMode })).run();
      if (project.snapshot_json) {
        try {
          const snapshot = JSON.parse(String(project.snapshot_json));
          const rows = await env.WATCHDOG_DB.prepare("SELECT payload_json, source, kind, observed_at FROM observations WHERE pool_id = ? AND observed_at > ? ORDER BY observed_at ASC LIMIT 1000").bind(project.pool_id, snapshot.capturedAt).all<Record<string, unknown>>();
          const payloads = rows.results.map((row) => { try { return { ...JSON.parse(String(row.payload_json)), storedSource: row.source, storedKind: row.kind, storedAt: row.observed_at }; } catch { return null; } }).filter(Boolean) as Array<Record<string, unknown>>;
          const ledgerTypes = new Set(["PAYMENT", "RECOVERY", "INTEREST", "FEE", "WRITE_DOWN"]);
          const ledgerEvents = payloads.filter((payload) => ledgerTypes.has(String(payload.type || payload.event || "").toUpperCase()));
          const chainEvents = payloads.filter((payload) => payload.source === "xlayer-rpc" || payload.storedSource === "xlayer-rpc");
          const publicSignals = payloads.filter((payload) => payload.source !== "xlayer-rpc" && payload.storedSource !== "xlayer-rpc");
          const capsule = reconstructAssetState({ snapshot, ledgerEvents, chainEvents, publicSignals, incident: evaluation });
          await env.WATCHDOG_DB.batch([
            env.WATCHDOG_DB.prepare("INSERT OR IGNORE INTO recovery_capsules (recovery_root, incident_id, pool_id, state, created_at, capsule_json) VALUES (?, ?, ?, ?, ?, ?)").bind(capsule.recoveryRoot, capsule.incidentId, capsule.poolId, capsule.state, startedAt, JSON.stringify(capsule)),
            env.WATCHDOG_DB.prepare("UPDATE incidents SET recovery_root = ?, state = ?, updated_at = ? WHERE incident_id = ?").bind(capsule.recoveryRoot, Number(project.shadow_mode ?? 1) ? `SHADOW_${capsule.state}` : capsule.state, startedAt, evaluation.incidentId),
          ]);
          let aiValidated = false;
          try {
            const existingInvestigation = await env.WATCHDOG_DB.prepare("SELECT investigation_id, valid FROM ai_investigations WHERE incident_id = ? AND recovery_root = ? LIMIT 1").bind(capsule.incidentId, capsule.recoveryRoot).first<{ investigation_id: string; valid: number }>();
            aiValidated = Boolean(existingInvestigation?.valid);
            if (!existingInvestigation) {
              const aiResult = await performInvestigation("Investigate this RWA servicing outage and the deterministic recovery capsule. Separate supported facts, inferences, missing evidence, and approval-gated actions.", { incident: evaluation, capsule }, env);
              aiValidated = aiResult.validation.valid;
              await env.WATCHDOG_DB.prepare("INSERT INTO ai_investigations (investigation_id, incident_id, created_at, model, valid, result_json, validation_json, recovery_root) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(`ai:${capsule.incidentId}:${capsule.recoveryRoot.slice(2, 18)}`, capsule.incidentId, startedAt, aiResult.model, aiResult.validation.valid ? 1 : 0, JSON.stringify(aiResult.investigation), JSON.stringify(aiResult.validation), capsule.recoveryRoot).run();
            }
          } catch (error) {
            await persistObservation(env.WATCHDOG_DB, { observationId: `ai-error:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: "ai-investigator", event: "AIInvestigationError", error: error instanceof Error ? error.message : String(error) });
          }
          const execution = executionPolicy({ confirmedSuspension, shadowMode, automaticSuspension: Number(project.automatic_suspension || 0), coordinatorAddress: project.coordinator_address, aiValidated, recoveryRoot: capsule.recoveryRoot });
          if (execution.ready) {
            const actionId = `suspend:${capsule.incidentId}:${capsule.recoveryRoot.slice(2, 18)}`;
            await env.WATCHDOG_DB.prepare("INSERT OR IGNORE INTO execution_queue (action_id, incident_id, pool_id, action, status, created_at, updated_at, payload_json, transaction_hash, error) VALUES (?, ?, ?, 'OPEN_INCIDENT_AND_SUSPEND', 'AWAITING_MULTISIG', ?, ?, ?, NULL, NULL)")
              .bind(actionId, capsule.incidentId, capsule.poolId, startedAt, startedAt, JSON.stringify({ coordinator: project.coordinator_address, registry: project.registry_address, incidentId: capsule.incidentId, poolId: capsule.poolId, servicerId: capsule.servicerId, recoveryRoot: capsule.recoveryRoot, lastTrustedAt: capsule.sourceSnapshot.capturedAt, policyGates: { ...execution.gates, consecutiveOutageRuns } })).run();
          }
        } catch (error) {
          await persistObservation(env.WATCHDOG_DB, { observationId: `reconstruction-error:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: "reconstruction-engine", event: "ReconstructionError", error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  }
  const finishedAt = new Date().toISOString();
  const currentLease = await env.WATCHDOG_DB.prepare("SELECT holder, lease_until FROM keeper_leases WHERE lease_id = 'xlayer-1952'").first<{ holder: string | null; lease_until: string }>();
  if (currentLease?.holder !== holder || Date.parse(currentLease.lease_until) <= Date.parse(finishedAt)) throw new Error("Keeper lease ownership was lost before the final commit.");
  await env.WATCHDOG_DB.batch([
    env.WATCHDOG_DB.prepare("INSERT INTO scanner_state (chain_id, last_scanned_block, updated_at) VALUES (1952, ?, ?) ON CONFLICT(chain_id) DO UPDATE SET last_scanned_block = excluded.last_scanned_block, updated_at = excluded.updated_at").bind(scan.toBlock, finishedAt),
    env.WATCHDOG_DB.prepare("INSERT INTO keeper_runs (run_id, started_at, finished_at, from_block, to_block, observations, status, error, trigger_source, lease_holder) VALUES (?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?)").bind(`keeper-${Date.now()}`, startedAt, finishedAt, scan.fromBlock, scan.toBlock, scan.observationCount, triggerSource, holder),
  ]);
  return scan;
}

async function projectsApi(request: Request, env: Env) {
  if (request.method === "GET") {
    const projects = await env.WATCHDOG_DB.prepare("SELECT pool_id, servicer_id, contract_address, sla_hours, grace_hours, last_heartbeat_at, enabled, created_at, updated_at, project_name, public_endpoint, observer_endpoints_json, last_state, consecutive_outage_runs, shadow_mode, automatic_suspension, coordinator_address, registry_address FROM projects ORDER BY created_at DESC").all<Record<string, unknown>>();
    return Response.json({ ok: true, projects: projects.results.map((project) => { let observerEndpointCount = 0; try { observerEndpointCount = JSON.parse(String(project.observer_endpoints_json || "[]")).length; } catch { /* Invalid stored data is reported as zero endpoints. */ } const safe = { ...project }; delete safe.observer_endpoints_json; return { ...safe, observerEndpointCount }; }) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env.WATCHDOG_ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.WATCHDOG_ADMIN_TOKEN}`) return new Response("Unauthorized", { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const poolId = String(body.poolId || "").trim();
  const servicerId = String(body.servicerId || "").trim();
  const lastHeartbeatAt = String(body.lastHeartbeatAt || "");
  if (!poolId || !servicerId || !Number.isFinite(Date.parse(lastHeartbeatAt))) return Response.json({ ok: false, error: "poolId, servicerId, and lastHeartbeatAt are required." }, { status: 422 });
  const now = new Date().toISOString();
  const snapshotJson = body.snapshot && typeof body.snapshot === "object" ? JSON.stringify(body.snapshot) : null;
  const observerEndpoints = normalizeObserverEndpoints(body.observerEndpoints);
  const publicEndpoint = normalizePublicEndpoint(body.publicEndpoint);
  await env.WATCHDOG_DB.prepare("INSERT INTO projects (pool_id, servicer_id, contract_address, sla_hours, grace_hours, last_heartbeat_at, enabled, created_at, updated_at, project_name, intelligence_query, public_endpoint, snapshot_json, shadow_mode, automatic_suspension, coordinator_address, registry_address, observer_endpoints_json) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(pool_id) DO UPDATE SET servicer_id=excluded.servicer_id, contract_address=excluded.contract_address, sla_hours=excluded.sla_hours, grace_hours=excluded.grace_hours, last_heartbeat_at=excluded.last_heartbeat_at, enabled=1, updated_at=excluded.updated_at, project_name=excluded.project_name, intelligence_query=excluded.intelligence_query, public_endpoint=excluded.public_endpoint, snapshot_json=COALESCE(excluded.snapshot_json, projects.snapshot_json), shadow_mode=excluded.shadow_mode, automatic_suspension=excluded.automatic_suspension, coordinator_address=COALESCE(excluded.coordinator_address, projects.coordinator_address), registry_address=COALESCE(excluded.registry_address, projects.registry_address), observer_endpoints_json=excluded.observer_endpoints_json")
    .bind(poolId, servicerId, body.contractAddress || null, Number(body.slaHours || 24), Number(body.graceHours || 6), lastHeartbeatAt, now, now, body.projectName || null, body.intelligenceQuery || null, publicEndpoint, snapshotJson, body.shadowMode === false ? 0 : 1, body.automaticSuspension === true ? 1 : 0, body.coordinatorAddress || null, body.registryAddress || null, JSON.stringify(observerEndpoints)).run();
  return Response.json({ ok: true, poolId });
}

async function servicerFeedApi(request: Request, env: Env) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env.SERVICER_FEED_HMAC_SECRET) return Response.json({ ok: false, error: "Servicer feed ingestion is not configured." }, { status: 503 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 }); }
  try {
    const feed = parseServicerFeed(raw);
    await verifyServicerFeedSignature(feed, env.SERVICER_FEED_HMAC_SECRET);
    const project = await env.WATCHDOG_DB.prepare("SELECT pool_id FROM projects WHERE pool_id = ? AND enabled = 1").bind(feed.snapshot.poolId).first();
    if (!project) return Response.json({ ok: false, error: "The signed feed does not belong to a registered enabled project." }, { status: 404 });
    const status = servicerFeedStatus(feed);
    if (status.ageHours > 144) throw new Error("Servicer feed is too old to evaluate.");
    const report = analyzePortfolio({ poolId: feed.snapshot.poolId, poolName: `Servicer pool ${feed.snapshot.poolId}`, asOf: new Date().toISOString(), assets: feed.assets, payments: feed.payments, tokenSupply: feed.snapshot.tokenSupply });
    const capsule = reconstructAssetState({ snapshot: { ...feed.snapshot, assets: feed.assets }, payments: feed.payments as never[], incident: { servicerId: feed.snapshot.source } });
    const replayKey = keccak256(stringToHex(`${feed.snapshot.poolId}:${feed.snapshot.capturedAt}:${feed.signature}`));
    const receivedAt = new Date().toISOString();
    const receipt = await env.WATCHDOG_DB.prepare("INSERT OR IGNORE INTO servicer_feed_receipts (replay_key, pool_id, source, captured_at, received_at, recovery_root, policy_state) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(replayKey, feed.snapshot.poolId, feed.snapshot.source, feed.snapshot.capturedAt, receivedAt, capsule.recoveryRoot, report.state).run();
    if (!receipt.meta.changes) return Response.json({ ok: false, error: "Servicer feed replay detected." }, { status: 409 });
    const snapshotJson = JSON.stringify({ ...feed.snapshot, assets: feed.assets });
    await env.WATCHDOG_DB.batch([
      env.WATCHDOG_DB.prepare("UPDATE projects SET snapshot_json = ?, last_heartbeat_at = CASE WHEN ? = 'healthy' AND last_heartbeat_at < ? THEN ? ELSE last_heartbeat_at END, updated_at = ? WHERE pool_id = ?")
        .bind(snapshotJson, feed.snapshot.heartbeat, feed.snapshot.capturedAt, feed.snapshot.capturedAt, receivedAt, feed.snapshot.poolId),
      env.WATCHDOG_DB.prepare("INSERT OR IGNORE INTO observations (observation_id, pool_id, source, kind, observed_at, block_number, transaction_hash, payload_json) VALUES (?, ?, ?, 'SignedServicerFeed', ?, NULL, NULL, ?)")
        .bind(`servicer-feed:${replayKey}`, feed.snapshot.poolId, `servicer:${feed.snapshot.source}`, receivedAt, JSON.stringify({ schema: feed.schema, poolId: feed.snapshot.poolId, source: feed.snapshot.source, capturedAt: feed.snapshot.capturedAt, heartbeat: feed.snapshot.heartbeat, recoveryRoot: capsule.recoveryRoot, policyState: report.state, assetCount: report.metrics.assetCount, paymentCount: report.metrics.paymentCount })),
    ]);
    const investigation = await performInvestigation("Investigate this signed RWA servicing snapshot and identify missing evidence. Do not infer facts outside the sanitized context.", { evidenceId: `servicer-feed:${replayKey}`, poolId: feed.snapshot.poolId, source: feed.snapshot.source, capturedAt: feed.snapshot.capturedAt, heartbeat: status.heartbeat, stale: status.stale, ageHours: Number(status.ageHours.toFixed(2)), policyState: report.state, recoveryRoot: capsule.recoveryRoot, assetCount: report.metrics.assetCount, paymentCount: report.metrics.paymentCount }, env);
    return Response.json({ ok: true, replayKey, poolId: feed.snapshot.poolId, source: feed.snapshot.source, status, policy: { state: report.state, assetCount: report.metrics.assetCount, paymentCount: report.metrics.paymentCount }, recovery: { recoveryRoot: capsule.recoveryRoot, state: capsule.state, conflictCount: capsule.totals.conflictCount }, ai: { mode: investigation.mode, valid: investigation.validation.valid } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Servicer feed rejected." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}

async function operationsHealthApi(env: Env) {
  const [runs, lease, scanner, projectCount] = await Promise.all([
    env.WATCHDOG_DB.prepare("SELECT finished_at, status, trigger_source FROM keeper_runs ORDER BY finished_at DESC LIMIT 24").all<Record<string, unknown>>(),
    env.WATCHDOG_DB.prepare("SELECT holder, lease_until, updated_at FROM keeper_leases WHERE lease_id = 'xlayer-1952'").first<Record<string, unknown>>(),
    env.WATCHDOG_DB.prepare("SELECT last_scanned_block, updated_at FROM scanner_state WHERE chain_id = 1952").first<Record<string, unknown>>(),
    env.WATCHDOG_DB.prepare("SELECT COUNT(*) AS count FROM projects WHERE enabled = 1").first<{ count: number }>(),
  ]);
  const health = evaluateOperationsHealth({ runs: runs.results, lease, scanner, enabledProjects: projectCount?.count || 0 });
  return Response.json({ ok: health.status !== "OUTAGE", persistent: true, chainId: 1952, automaticBroadcastEnabled: false, ...health }, { status: health.status === "OUTAGE" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}

async function executionApi(request: Request, env: Env) {
  if (request.method === "GET") {
    const admin = Boolean(env.WATCHDOG_ADMIN_TOKEN) && request.headers.get("Authorization") === `Bearer ${env.WATCHDOG_ADMIN_TOKEN}`;
    const rows = await env.WATCHDOG_DB.prepare("SELECT action_id, incident_id, pool_id, action, status, created_at, updated_at, transaction_hash, error, payload_json FROM execution_queue ORDER BY created_at DESC LIMIT 100").all<Record<string, unknown>>();
    const actions = rows.results.map((row) => ({ actionId: row.action_id, incidentId: row.incident_id, poolId: row.pool_id, action: row.action, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, transactionHash: row.transaction_hash, error: row.error, ...(admin ? { payload: JSON.parse(String(row.payload_json || "{}")) } : {}) }));
    return Response.json({ ok: true, automaticBroadcastEnabled: false, actions }, { headers: { "Cache-Control": "no-store" } });
  }
  return new Response("Automatic broadcast is disabled until a deployed coordinator, authorized keeper, multisig quorum, and funded gas policy are verified.", { status: 409 });
}

async function recoveryApi(request: Request, env: Env) {
  const admin = Boolean(env.WATCHDOG_ADMIN_TOKEN) && request.headers.get("Authorization") === `Bearer ${env.WATCHDOG_ADMIN_TOKEN}`;
  const url = new URL(request.url);
  const incidentId = url.searchParams.get("incidentId");
  const query = incidentId ? env.WATCHDOG_DB.prepare("SELECT * FROM recovery_capsules WHERE incident_id = ? ORDER BY created_at DESC LIMIT 20").bind(incidentId) : env.WATCHDOG_DB.prepare("SELECT * FROM recovery_capsules ORDER BY created_at DESC LIMIT 50");
  const rows = await query.all<Record<string, unknown>>();
  return Response.json({ ok: true, capsules: rows.results.map((row) => ({ recoveryRoot: row.recovery_root, incidentId: row.incident_id, poolId: row.pool_id, state: row.state, createdAt: row.created_at, ...(admin ? { capsule: JSON.parse(String(row.capsule_json || "{}")) } : {}) })) }, { headers: { "Cache-Control": "no-store" } });
}

async function evidenceApi(env: Env) {
  let projects: unknown[] = [];
  let incidents: unknown[] = [];
  let recoveryCapsules: unknown[] = [];
  let keeperRuns: unknown[] = [];
  let runtimeEvidenceAvailable = true;
  try {
    const results = await Promise.all([
      env.WATCHDOG_DB.prepare("SELECT pool_id, servicer_id, contract_address, coordinator_address, registry_address, last_state, consecutive_outage_runs, updated_at FROM projects ORDER BY updated_at DESC LIMIT 50").all(),
      env.WATCHDOG_DB.prepare("SELECT incident_id, pool_id, state, opened_at, updated_at, recovery_root FROM incidents ORDER BY updated_at DESC LIMIT 50").all(),
      env.WATCHDOG_DB.prepare("SELECT recovery_root, incident_id, pool_id, state, created_at FROM recovery_capsules ORDER BY created_at DESC LIMIT 50").all(),
      env.WATCHDOG_DB.prepare("SELECT run_id, started_at, finished_at, from_block, to_block, observations, status, trigger_source FROM keeper_runs ORDER BY started_at DESC LIMIT 20").all(),
    ]);
    projects = results[0].results;
    incidents = results[1].results;
    recoveryCapsules = results[2].results;
    keeperRuns = results[3].results;
  } catch {
    runtimeEvidenceAvailable = false;
  }
  return Response.json({
    ok: true,
    schema: "duevia.evidence/v2",
    generatedAt: new Date().toISOString(),
    chainId: 1952,
    release: {
      name: env.DUEVIA_RELEASE || dueviaRelease,
      gitCommit: env.DUEVIA_GIT_COMMIT || "unknown",
      frontendVersion: env.DUEVIA_GIT_COMMIT || "unknown",
      deployedAt: env.DUEVIA_DEPLOYED_AT || env.CF_VERSION_METADATA?.timestamp || null,
      workerVersion: env.CF_VERSION_METADATA?.id || null,
      workerTag: env.CF_VERSION_METADATA?.tag || null,
    },
    project: dueviaProject,
    contracts: dueviaContracts,
    governanceTransactions: dueviaGovernanceTransactions,
    legacyRehearsalTransactions,
    runtimeEvidenceAvailable,
    projects,
    incidents,
    recoveryCapsules,
    keeperRuns,
  }, { headers: { "Cache-Control": "no-store" } });
}

async function watchdogApi(request: Request, env: Env) {
  if (request.method === "GET") {
    const [incidents, runs, observations] = await Promise.all([
      env.WATCHDOG_DB.prepare("SELECT incident_id, pool_id, servicer_id, state, opened_at, updated_at, recovery_root FROM incidents ORDER BY updated_at DESC LIMIT 50").all(),
      env.WATCHDOG_DB.prepare("SELECT * FROM keeper_runs ORDER BY started_at DESC LIMIT 20").all(),
      env.WATCHDOG_DB.prepare("SELECT observation_id, pool_id, source, kind, observed_at, block_number, transaction_hash FROM observations ORDER BY observed_at DESC LIMIT 100").all(),
    ]);
    return Response.json({ ok: true, persistent: true, incidents: incidents.results, keeperRuns: runs.results, observations: observations.results }, { headers: { "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const adminAuthorized = Boolean(env.WATCHDOG_ADMIN_TOKEN) && request.headers.get("Authorization") === `Bearer ${env.WATCHDOG_ADMIN_TOKEN}`;
    const observer = String(input.observer || "").toLowerCase();
    const nonce = String(input.nonce || "");
    const signature = String(input.signature || "");
    const allowedObservers = new Set((env.WATCHDOG_OBSERVER_ADDRESSES || "").toLowerCase().split(",").map((value) => value.trim()).filter(Boolean));
    const message = `Duevia observation\n${String(input.poolId || "")}\n${String(input.servicerId || "")}\n${String(input.lastHeartbeatAt || "")}\n${nonce}`;
    const observerAuthorized = /^0x[0-9a-f]{40}$/.test(observer) && allowedObservers.has(observer) && nonce && /^0x[0-9a-f]+$/.test(signature) && await verifyMessage({ address: observer as `0x${string}`, message, signature: signature as `0x${string}` });
    if (!adminAuthorized && !observerAuthorized) return Response.json({ ok: false, error: "A configured administrator token or authorized observer signature is required." }, { status: 401 });
    const result = evaluateWatchdog(input);
    const observationId = observerAuthorized ? `observer:${observer}:${nonce}` : `watchdog-${crypto.randomUUID()}`;
    const existing = await env.WATCHDOG_DB.prepare("SELECT observation_id FROM observations WHERE observation_id = ?").bind(observationId).first();
    if (existing) return Response.json({ ok: false, error: "Observer nonce replay detected." }, { status: 409 });
    await persistObservation(env.WATCHDOG_DB, { observationId, poolId: result.poolId, source: observerAuthorized ? observer : "watchdog-admin", kind: "watchdog-evaluation", ...result });
    if (result.incidentId) {
      const now = new Date().toISOString();
      await env.WATCHDOG_DB.prepare("INSERT INTO incidents (incident_id, pool_id, servicer_id, state, opened_at, updated_at, recovery_root, evidence_json) VALUES (?, ?, ?, ?, ?, ?, NULL, ?) ON CONFLICT(incident_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at, evidence_json = excluded.evidence_json")
        .bind(result.incidentId, result.poolId, result.servicerId, result.state, now, now, JSON.stringify(result)).run();
    }
    return Response.json({ ok: true, persistent: true, incident: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Watchdog evaluation failed." }, { status: 422 });
  }
}

async function performInvestigation(question: string, contextObject: unknown, env: Env) {
    const context = JSON.stringify(contextObject).slice(0, 30_000);
    const evidenceIds = [...collectEvidenceIds(contextObject)];
    if (!evidenceIds.length) evidenceIds.push("context-root");
    const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    const verifierModel = "@cf/meta/llama-3.1-8b-instruct-fast";
    const investigationShape = { schema: "duevia.ai-investigation/v1", incidentId: "string|null", summary: "string", riskLevel: "LOW|MEDIUM|HIGH|CRITICAL", facts: [{ claim: "string", evidenceIds: ["string"] }], inferences: [{ claim: "string", basis: "string", confidence: "LOW|MEDIUM|HIGH" }], missingEvidence: [{ item: "string", impact: "string" }], recommendedActions: [{ action: "string", reason: "string", requiresApproval: true }] };
    const investigationSchema = { type: "object", properties: { schema: { type: "string", const: "duevia.ai-investigation/v1" }, incidentId: { anyOf: [{ type: "string" }, { type: "null" }] }, summary: { type: "string" }, riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, facts: { type: "array", items: { type: "object", properties: { claim: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["claim", "evidenceIds"], additionalProperties: false } }, inferences: { type: "array", items: { type: "object", properties: { claim: { type: "string" }, basis: { type: "string" }, confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] } }, required: ["claim", "basis", "confidence"], additionalProperties: false } }, missingEvidence: { type: "array", items: { type: "object", properties: { item: { type: "string" }, impact: { type: "string" } }, required: ["item", "impact"], additionalProperties: false } }, recommendedActions: { type: "array", items: { type: "object", properties: { action: { type: "string" }, reason: { type: "string" }, requiresApproval: { type: "boolean" } }, required: ["action", "reason", "requiresApproval"], additionalProperties: false } } }, required: ["schema", "incidentId", "summary", "riskLevel", "facts", "inferences", "missingEvidence", "recommendedActions"], additionalProperties: false };
    let investigation: Record<string, unknown>;
    try {
      const output = await env.AI.run(model, { response_format: { type: "json_schema", json_schema: investigationSchema }, messages: [
        { role: "system", content: "You are Duevia, an RWA continuity investigator. Return only valid JSON. Use only supplied evidence. Never claim legal ownership, audit assurance, repayment certainty, or permission to bypass deterministic policy. Every fact must cite one or more IDs from the supplied evidence catalog. Material actions must set requiresApproval=true." },
        { role: "user", content: `${question}\n\nEvidence catalog: ${JSON.stringify(evidenceIds)}\nStructured evidence:\n${context}\n\nReturn this exact shape: ${JSON.stringify(investigationShape)}` },
      ] });
      investigation = modelResponseObject(output) as Record<string, unknown>;
    } catch (error) {
      const incidentId = contextObject && typeof contextObject === "object" && "incident" in contextObject && contextObject.incident && typeof contextObject.incident === "object" && "incidentId" in contextObject.incident ? String(contextObject.incident.incidentId || "") : null;
      investigation = failedInvestigation(incidentId, error instanceof Error ? error.message : String(error));
    }
    const deterministicValidation = validateInvestigation(investigation, evidenceIds);
    let modelValidation = { valid: false, violations: ["Verifier did not run."], reason: "" };
    if (deterministicValidation.valid) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const verifierOutput = await env.AI.run(verifierModel, { response_format: { type: "json_schema", json_schema: { type: "object", properties: { valid: { type: "boolean" }, unsupportedClaims: { type: "array", items: { type: "string" } }, reason: { type: "string" } }, required: ["valid", "unsupportedClaims", "reason"], additionalProperties: false } }, messages: [
            { role: "system", content: "You are an independent evidence verifier. Return valid JSON only. Reject any factual claim not supported by the supplied structured evidence, and reject any material action that lacks explicit approval." },
            { role: "user", content: `Evidence catalog: ${JSON.stringify(evidenceIds)}. The context-root ID refers to the complete supplied context when present.\nEvidence:\n${context}\n\nCandidate investigation:\n${JSON.stringify(investigation)}\n\nReturn ${JSON.stringify({ valid: true, unsupportedClaims: ["string"], reason: "string" })}.` },
          ] });
          modelValidation = validateModelVerifier(modelResponseObject(verifierOutput));
          break;
        } catch (error) {
          modelValidation = { valid: false, violations: [error instanceof Error ? error.message : "Verifier unavailable."], reason: "Independent verifier did not produce a valid result." };
        }
      }
    }
    const verified = deterministicValidation.valid && modelValidation.valid;
    return { answer: investigation.summary, investigation, validation: { valid: verified, deterministic: deterministicValidation, verifier: modelValidation }, mode: verified ? "model-grounded" : "review-required", provider: "cloudflare-workers-ai", model, verifierModel };
}

async function aiApi(request: Request, env: Env) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const body = await request.json() as { question?: unknown; context?: unknown };
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 2_000) : "";
    if (!question) return Response.json({ error: "A non-empty investigation question is required.", mode: "cloudflare-workers-ai" }, { status: 400 });
    return Response.json(await performInvestigation(question, body.context || {}, env), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI model unavailable.", mode: "grounded-fallback" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/watchdog") return watchdogApi(request, env);
    if (url.pathname === "/api/observer/status") return observerStatusApi(request, env);
    if (url.pathname === "/api/watchdog/projects") return projectsApi(request, env);
    if (url.pathname === "/api/operations/health" && request.method === "GET") return operationsHealthApi(env);
    if (url.pathname === "/api/servicer-feed") return servicerFeedApi(request, env);
    if (url.pathname === "/api/recovery" && request.method === "GET") return recoveryApi(request, env);
    if (url.pathname === "/api/evidence" && request.method === "GET") return evidenceApi(env);
    if (url.pathname === "/api/execution") return executionApi(request, env);
    if (url.pathname === "/api/agent" && request.method === "POST") return aiApi(request, env);
    if (url.pathname === "/api/agent/health" && request.method === "GET") return Response.json({ ok: true, provider: "cloudflare-workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", mode: "model-grounded" }, { headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/api/keeper/run" && request.method === "POST") {
      if (!env.WATCHDOG_ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.WATCHDOG_ADMIN_TOKEN}`) return new Response("Unauthorized", { status: 401 });
      const requestedSource = request.headers.get("X-Duevia-Keeper-Id") || "external-failover";
      const triggerSource = /^[a-zA-Z0-9_.:-]{1,64}$/.test(requestedSource) ? requestedSource : "external-failover";
      const scan = await runKeeper(env, triggerSource);
      return Response.json({ ok: true, persistent: true, ...scan });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runKeeper(env, "cloudflare-cron-primary"));
  },
};

export default worker;
