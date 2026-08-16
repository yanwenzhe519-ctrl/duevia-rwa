/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { evaluateWatchdog } from "../lib/continuity-watchdog.mjs";
import { scanXLayer } from "../lib/xlayer-scanner.mjs";
import { verifyMessage } from "viem";
import { searchPublicIntelligence } from "../lib/public-intelligence.mjs";
import { collectEvidenceIds, failedInvestigation, modelResponseObject, validateInvestigation, validateModelVerifier } from "../lib/ai-investigation.mjs";
import { reconstructAssetState } from "../lib/reconstruction-engine.mjs";
import { evaluateProjectRun, executionPolicy } from "../lib/keeper-policy.mjs";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  WATCHDOG_DB: D1Database;
  XLAYER_RPC_URL?: string;
  WATCHDOG_ADMIN_TOKEN?: string;
  WATCHDOG_OBSERVER_ADDRESSES?: string;
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

async function runKeeper(env: Env) {
  const startedAt = new Date().toISOString();
  const holder = crypto.randomUUID();
  const leaseUntil = new Date(Date.parse(startedAt) + 4 * 60_000).toISOString();
  const lease = await env.WATCHDOG_DB.prepare("UPDATE keeper_leases SET holder = ?, lease_until = ?, updated_at = ? WHERE lease_id = 'xlayer-1952' AND lease_until < ?")
    .bind(holder, leaseUntil, startedAt, startedAt).run();
  if (!lease.meta.changes) return { skipped: true, reason: "keeper-lease-held", observationCount: 0 };
  try {
    return await runKeeperOnce(env, startedAt);
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await env.WATCHDOG_DB.prepare("INSERT INTO keeper_runs (run_id, started_at, finished_at, from_block, to_block, observations, status, error) VALUES (?, ?, ?, 'unknown', 'unknown', 0, 'error', ?)")
      .bind(`keeper-error-${Date.now()}`, startedAt, finishedAt, error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000)).run();
    throw error;
  } finally {
    const releasedAt = new Date().toISOString();
    await env.WATCHDOG_DB.prepare("UPDATE keeper_leases SET holder = NULL, lease_until = ?, updated_at = ? WHERE lease_id = 'xlayer-1952' AND holder = ?")
      .bind(releasedAt, releasedAt, holder).run();
  }
}

async function runKeeperOnce(env: Env, startedAt: string) {
  const cursor = await env.WATCHDOG_DB.prepare("SELECT last_scanned_block FROM scanner_state WHERE chain_id = 1952").first<{ last_scanned_block: string }>();
  const scan = await scanXLayer({ rpcUrl: env.XLAYER_RPC_URL || "https://testrpc.xlayer.tech", fromBlock: cursor ? BigInt(cursor.last_scanned_block) + 1n : undefined });
  for (const observation of scan.observations) await persistObservation(env.WATCHDOG_DB, observation);
  const projects = await env.WATCHDOG_DB.prepare("SELECT * FROM projects WHERE enabled = 1").all<Record<string, unknown>>();
  for (const project of projects.results) {
    const signals: Array<Record<string, unknown>> = [];
    const contractActivity = scan.observations.some((observation) => String(observation.address).toLowerCase() === String(project.contract_address || "").toLowerCase());
    let lastHeartbeatAt = contractActivity ? startedAt : String(project.last_heartbeat_at);
    if (project.public_endpoint) {
      let ok = false;
      let status = 0;
      try { const response = await fetch(String(project.public_endpoint), { method: "GET", signal: AbortSignal.timeout(8_000) }); ok = response.ok; status = response.status; } catch { /* A failed independent endpoint is an observation, not a keeper failure. */ }
      await persistObservation(env.WATCHDOG_DB, { observationId: `endpoint:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: "independent-endpoint", event: "EndpointCheck", ok, status, endpoint: project.public_endpoint });
      let endpointSource = "endpoint:invalid";
      try { endpointSource = `endpoint:${new URL(String(project.public_endpoint)).host}`; } catch { /* Invalid registered endpoints remain failed observations. */ }
      signals.push({ type: "endpoint", source: endpointSource, ok, status });
      if (ok) lastHeartbeatAt = startedAt;
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
  await env.WATCHDOG_DB.batch([
    env.WATCHDOG_DB.prepare("INSERT INTO scanner_state (chain_id, last_scanned_block, updated_at) VALUES (1952, ?, ?) ON CONFLICT(chain_id) DO UPDATE SET last_scanned_block = excluded.last_scanned_block, updated_at = excluded.updated_at").bind(scan.toBlock, finishedAt),
    env.WATCHDOG_DB.prepare("INSERT INTO keeper_runs (run_id, started_at, finished_at, from_block, to_block, observations, status, error) VALUES (?, ?, ?, ?, ?, ?, 'ok', NULL)").bind(`keeper-${Date.now()}`, startedAt, finishedAt, scan.fromBlock, scan.toBlock, scan.observationCount),
  ]);
  return scan;
}

async function projectsApi(request: Request, env: Env) {
  if (request.method === "GET") {
    const projects = await env.WATCHDOG_DB.prepare("SELECT pool_id, servicer_id, contract_address, sla_hours, grace_hours, last_heartbeat_at, enabled, created_at, updated_at, project_name, public_endpoint, last_state, consecutive_outage_runs, shadow_mode, automatic_suspension, coordinator_address, registry_address FROM projects ORDER BY created_at DESC").all();
    return Response.json({ ok: true, projects: projects.results }, { headers: { "Cache-Control": "no-store" } });
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
  await env.WATCHDOG_DB.prepare("INSERT INTO projects (pool_id, servicer_id, contract_address, sla_hours, grace_hours, last_heartbeat_at, enabled, created_at, updated_at, project_name, intelligence_query, public_endpoint, snapshot_json, shadow_mode, automatic_suspension, coordinator_address, registry_address) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(pool_id) DO UPDATE SET servicer_id=excluded.servicer_id, contract_address=excluded.contract_address, sla_hours=excluded.sla_hours, grace_hours=excluded.grace_hours, last_heartbeat_at=excluded.last_heartbeat_at, enabled=1, updated_at=excluded.updated_at, project_name=excluded.project_name, intelligence_query=excluded.intelligence_query, public_endpoint=excluded.public_endpoint, snapshot_json=COALESCE(excluded.snapshot_json, projects.snapshot_json), shadow_mode=excluded.shadow_mode, automatic_suspension=excluded.automatic_suspension, coordinator_address=COALESCE(excluded.coordinator_address, projects.coordinator_address), registry_address=COALESCE(excluded.registry_address, projects.registry_address)")
    .bind(poolId, servicerId, body.contractAddress || null, Number(body.slaHours || 24), Number(body.graceHours || 6), lastHeartbeatAt, now, now, body.projectName || null, body.intelligenceQuery || null, body.publicEndpoint || null, snapshotJson, body.shadowMode === false ? 0 : 1, body.automaticSuspension === true ? 1 : 0, body.coordinatorAddress || null, body.registryAddress || null).run();
  return Response.json({ ok: true, poolId });
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
    if (url.pathname === "/api/watchdog/projects") return projectsApi(request, env);
    if (url.pathname === "/api/recovery" && request.method === "GET") return recoveryApi(request, env);
    if (url.pathname === "/api/execution") return executionApi(request, env);
    if (url.pathname === "/api/agent" && request.method === "POST") return aiApi(request, env);
    if (url.pathname === "/api/agent/health" && request.method === "GET") return Response.json({ ok: true, provider: "cloudflare-workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", mode: "model-grounded" }, { headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/api/keeper/run" && request.method === "POST") {
      if (!env.WATCHDOG_ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.WATCHDOG_ADMIN_TOKEN}`) return new Response("Unauthorized", { status: 401 });
      const scan = await runKeeper(env);
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
    ctx.waitUntil(runKeeper(env));
  },
};

export default worker;
