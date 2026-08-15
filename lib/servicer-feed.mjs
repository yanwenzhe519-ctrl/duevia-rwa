const MAX_FEED_BYTES = 1_000_000;

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Servicer feed field '${field}' is required.`);
  return value.trim();
}

function requiredArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`Servicer feed field '${field}' must be an array.`);
  return value;
}

/**
 * Normalizes the Duevia Servicer Feed v1 envelope. The feed is deliberately
 * boring: signed snapshot metadata plus the same asset/payment rows consumed
 * by the deterministic portfolio engine. Adapters can map ERP or bank APIs
 * into this envelope without changing policy logic.
 */
export function parseServicerFeed(input) {
  const raw = typeof input === "string" ? input : JSON.stringify(input);
  if (!raw || raw.length > MAX_FEED_BYTES) throw new Error("Servicer feed is empty or exceeds the 1 MB limit.");
  let feed;
  try { feed = typeof input === "string" ? JSON.parse(input) : input; } catch { throw new Error("Servicer feed must be valid JSON."); }
  if (!feed || typeof feed !== "object") throw new Error("Servicer feed must be a JSON object.");
  const envelope = feed;
  if (envelope.schema !== "duevia.servicer-feed/v1") throw new Error("Unsupported servicer feed schema.");
  const snapshot = envelope.snapshot;
  if (!snapshot || typeof snapshot !== "object") throw new Error("Servicer feed snapshot is required.");
  const poolId = requiredString(snapshot.poolId, "snapshot.poolId");
  const capturedAt = requiredString(snapshot.capturedAt, "snapshot.capturedAt");
  const heartbeat = requiredString(snapshot.heartbeat, "snapshot.heartbeat");
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error("snapshot.capturedAt must be an ISO timestamp.");
  const assets = requiredArray(envelope.assets, "assets");
  const payments = requiredArray(envelope.payments, "payments");
  const signature = requiredString(envelope.signature, "signature");
  for (const asset of assets) {
    requiredString(asset?.assetId, "asset.assetId");
    requiredString(asset?.invoiceId, "asset.invoiceId");
    requiredString(asset?.documentHash, "asset.documentHash");
  }
  for (const payment of payments) {
    requiredString(payment?.paymentId, "payment.paymentId");
    requiredString(payment?.invoiceId, "payment.invoiceId");
  }
  return {
    schema: envelope.schema,
    signature,
    snapshot: { poolId, capturedAt, heartbeat, source: requiredString(snapshot.source || "servicer", "snapshot.source") },
    assets,
    payments,
  };
}

export function servicerFeedStatus(feed, asOf = new Date().toISOString(), maxHeartbeatHours = 72) {
  const captured = Date.parse(feed.snapshot.capturedAt);
  const now = Date.parse(asOf);
  const ageHours = Number.isFinite(captured) && Number.isFinite(now) ? Math.max(0, (now - captured) / 3_600_000) : Infinity;
  return { ageHours, heartbeat: feed.snapshot.heartbeat, stale: ageHours >= maxHeartbeatHours || feed.snapshot.heartbeat !== "healthy" };
}
