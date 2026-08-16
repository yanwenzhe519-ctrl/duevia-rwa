/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { evaluateWatchdog } from "../lib/continuity-watchdog.mjs";
import { scanXLayer } from "../lib/xlayer-scanner.mjs";
import { verifyMessage } from "viem";
import { searchPublicIntelligence } from "../lib/public-intelligence.mjs";

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
  const cursor = await env.WATCHDOG_DB.prepare("SELECT last_scanned_block FROM scanner_state WHERE chain_id = 1952").first<{ last_scanned_block: string }>();
  const scan = await scanXLayer({ rpcUrl: env.XLAYER_RPC_URL || "https://testrpc.xlayer.tech", fromBlock: cursor ? BigInt(cursor.last_scanned_block) + 1n : undefined });
  for (const observation of scan.observations) await persistObservation(env.WATCHDOG_DB, observation);
  const projects = await env.WATCHDOG_DB.prepare("SELECT * FROM projects WHERE enabled = 1").all<Record<string, unknown>>();
  for (const project of projects.results) {
    if (project.public_endpoint) {
      let ok = false;
      let status = 0;
      try { const response = await fetch(String(project.public_endpoint), { method: "GET", signal: AbortSignal.timeout(8_000) }); ok = response.ok; status = response.status; } catch { /* A failed independent endpoint is an observation, not a keeper failure. */ }
      await persistObservation(env.WATCHDOG_DB, { observationId: `endpoint:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: "independent-endpoint", event: "EndpointCheck", ok, status, endpoint: project.public_endpoint });
    }
    if (project.intelligence_query) {
      try {
        const intelligence = await searchPublicIntelligence({ query: String(project.intelligence_query) });
        await persistObservation(env.WATCHDOG_DB, { observationId: `intelligence:${project.pool_id}:${Date.now()}`, poolId: project.pool_id, source: intelligence.source, event: "PublicIntelligence", ...intelligence });
      } catch { /* Public intelligence is one independent source and must not stop chain scanning. */ }
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
    const projects = await env.WATCHDOG_DB.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
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
  await env.WATCHDOG_DB.prepare("INSERT INTO projects (pool_id, servicer_id, contract_address, sla_hours, grace_hours, last_heartbeat_at, enabled, created_at, updated_at, project_name, intelligence_query, public_endpoint) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?) ON CONFLICT(pool_id) DO UPDATE SET servicer_id=excluded.servicer_id, contract_address=excluded.contract_address, sla_hours=excluded.sla_hours, grace_hours=excluded.grace_hours, last_heartbeat_at=excluded.last_heartbeat_at, enabled=1, updated_at=excluded.updated_at, project_name=excluded.project_name, intelligence_query=excluded.intelligence_query, public_endpoint=excluded.public_endpoint")
    .bind(poolId, servicerId, body.contractAddress || null, Number(body.slaHours || 24), Number(body.graceHours || 6), lastHeartbeatAt, now, now, body.projectName || null, body.intelligenceQuery || null, body.publicEndpoint || null).run();
  return Response.json({ ok: true, poolId });
}

async function watchdogApi(request: Request, env: Env) {
  if (request.method === "GET") {
    const [incidents, runs, observations] = await Promise.all([
      env.WATCHDOG_DB.prepare("SELECT * FROM incidents ORDER BY updated_at DESC LIMIT 50").all(),
      env.WATCHDOG_DB.prepare("SELECT * FROM keeper_runs ORDER BY started_at DESC LIMIT 20").all(),
      env.WATCHDOG_DB.prepare("SELECT * FROM observations ORDER BY observed_at DESC LIMIT 100").all(),
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

async function aiApi(request: Request, env: Env) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const body = await request.json() as { question?: unknown; context?: unknown };
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 2_000) : "";
    if (!question) return Response.json({ error: "A non-empty investigation question is required.", mode: "cloudflare-workers-ai" }, { status: 400 });
    const context = JSON.stringify(body.context || {}).slice(0, 30_000);
    const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    const output = await env.AI.run(model, { messages: [
      { role: "system", content: "You are Duevia, an RWA continuity investigator. Use only supplied evidence. Separate facts, inferences, missing evidence, and actions. Never claim legal ownership, audit assurance, repayment certainty, or permission to bypass deterministic policy." },
      { role: "user", content: `${question}\n\nStructured evidence:\n${context}` },
    ] });
    const answer = typeof output.response === "string" ? output.response : JSON.stringify(output);
    return Response.json({ answer: answer.slice(0, 12_000), mode: "model-grounded", provider: "cloudflare-workers-ai", model }, { headers: { "Cache-Control": "no-store" } });
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
