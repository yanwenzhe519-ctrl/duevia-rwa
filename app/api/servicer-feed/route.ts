import { analyzePortfolio } from "@/lib/portfolio-engine.mjs";
import { parseServicerFeed, servicerFeedStatus } from "@/lib/servicer-feed.mjs";
import { verifyServicerFeedSignature } from "@/lib/servicer-feed-security.mjs";

const MAX_AGE_HOURS = 72;
const replayCache = new Map<string, number>();

function rejectReplay(feed: ReturnType<typeof parseServicerFeed>) {
  const key = `${feed.snapshot.poolId}:${feed.snapshot.capturedAt}:${feed.signature}`;
  const now = Date.now();
  for (const [cachedKey, expiresAt] of replayCache) if (expiresAt <= now) replayCache.delete(cachedKey);
  if (replayCache.has(key)) throw new Error("Servicer feed replay detected.");
  replayCache.set(key, now + 7 * 24 * 60 * 60 * 1000);
  if (replayCache.size > 10_000) replayCache.delete(replayCache.keys().next().value as string);
}

function sanitizedContext(feed: ReturnType<typeof parseServicerFeed>, report: ReturnType<typeof analyzePortfolio>, status: ReturnType<typeof servicerFeedStatus>) {
  return {
    schema: feed.schema,
    poolId: feed.snapshot.poolId,
    source: feed.snapshot.source,
    capturedAt: feed.snapshot.capturedAt,
    heartbeat: status.heartbeat,
    stale: status.stale,
    ageHours: Number(status.ageHours.toFixed(2)),
    assetCount: report.metrics.assetCount,
    paymentCount: report.metrics.paymentCount,
    totalOutstanding: report.metrics.totalOutstanding,
    eligibleOutstanding: report.metrics.eligibleOutstanding,
    policyState: report.state,
    alerts: report.alerts.map((alert) => ({ code: alert.code, severity: alert.severity, assetCount: alert.assets?.length || 0 })),
  };
}

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  try {
    const feed = parseServicerFeed(raw);
    await verifyServicerFeedSignature(feed, process.env.SERVICER_FEED_HMAC_SECRET);
    rejectReplay(feed);
    const status = servicerFeedStatus(feed);
    if (status.ageHours > MAX_AGE_HOURS * 2) throw new Error("Servicer feed is too old to evaluate.");

    const report = analyzePortfolio({
      poolId: feed.snapshot.poolId,
      poolName: `Servicer pool ${feed.snapshot.poolId}`,
      asOf: feed.snapshot.capturedAt,
      assets: feed.assets,
      payments: feed.payments,
      tokenSupply: feed.assets.reduce((sum, asset) => sum + Number(asset.outstanding || 0), 0),
    });
    const context = sanitizedContext(feed, report, status);
    let ai: { answer?: string; mode: string } = { mode: "grounded-fallback" };
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch(new URL("/api/agent", request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Summarize this servicer snapshot and list missing evidence or recovery actions.", context }),
      });
      const data = await response.json() as { answer?: string; mode?: string };
      ai = { answer: data.answer, mode: data.mode || "grounded-fallback" };
    }
    return Response.json({ ok: true, source: feed.snapshot.source, status, policy: { state: report.state, metrics: report.metrics, alerts: report.alerts }, ai, sanitizedContext: context }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Servicer feed rejected." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
