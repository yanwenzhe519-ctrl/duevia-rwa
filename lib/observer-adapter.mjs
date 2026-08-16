const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const signaturePattern = /^0x[0-9a-fA-F]+$/;
const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const privateIpv6 = /^\[(::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i;

export function normalizePublicEndpoint(value, fieldName = "publicEndpoint") {
  if (value == null || String(value).trim() === "") return null;
  const url = new URL(String(value));
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error(`${fieldName} must be a public HTTPS URL without credentials or a custom port.`);
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname === "::1" || hostname === "[::1]" || hostname === "0.0.0.0" || privateIpv4.test(hostname) || privateIpv6.test(hostname)) throw new Error(`${fieldName} must not target a private network.`);
  url.hash = "";
  return url.toString();
}

export function normalizeObserverEndpoints(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 5) throw new Error("observerEndpoints must be an array of at most five HTTPS URLs.");
  const normalized = value.map((entry) => normalizePublicEndpoint(entry, "Observer endpoint"));
  if (new Set(normalized).size !== normalized.length) throw new Error("Observer endpoints must be unique.");
  return normalized;
}

export function observerStatusMessage(envelope) {
  return `Duevia observer status\n${envelope.poolId}\n${envelope.observedAt}\n${envelope.status}\n${envelope.evidenceHash}\n${envelope.nonce}`;
}

export function parseObserverStatus(input, expectedPoolId, now = new Date().toISOString(), maxAgeMinutes = 15) {
  if (!input || typeof input !== "object" || input.schema !== "duevia.observer-status/v1") throw new Error("Observer response must use duevia.observer-status/v1.");
  const poolId = String(input.poolId || "").trim();
  const observer = String(input.observer || "").toLowerCase();
  const observedAt = String(input.observedAt || "");
  const status = String(input.status || "").toUpperCase();
  const evidenceHash = String(input.evidenceHash || "");
  const nonce = String(input.nonce || "").trim();
  const signature = String(input.signature || "");
  if (!poolId || poolId !== expectedPoolId) throw new Error("Observer poolId does not match the registered project.");
  if (!addressPattern.test(observer)) throw new Error("Observer address is invalid.");
  if (!hashPattern.test(evidenceHash)) throw new Error("Observer evidenceHash must be bytes32.");
  if (!signaturePattern.test(signature)) throw new Error("Observer signature is invalid.");
  if (!nonce || nonce.length > 128) throw new Error("Observer nonce is invalid.");
  if (!["HEALTHY", "DEGRADED", "OUTAGE"].includes(status)) throw new Error("Observer status is unsupported.");
  const observedMs = Date.parse(observedAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs)) throw new Error("Observer timestamps must be valid ISO values.");
  const ageMinutes = (nowMs - observedMs) / 60_000;
  if (ageMinutes < -5 || ageMinutes > maxAgeMinutes) throw new Error("Observer response is outside the allowed freshness window.");
  return { schema: input.schema, poolId, observer, observedAt: new Date(observedMs).toISOString(), status, evidenceHash, nonce, signature };
}

export async function verifyObserverStatus(envelope, allowedObservers, verify) {
  if (!allowedObservers.has(envelope.observer)) throw new Error("Observer is not authorized.");
  const valid = await verify({ address: envelope.observer, message: observerStatusMessage(envelope), signature: envelope.signature });
  if (!valid) throw new Error("Observer signature verification failed.");
  return {
    type: "endpoint",
    source: `observer:${envelope.observer}`,
    ok: envelope.status === "HEALTHY",
    status: envelope.status,
    observedAt: envelope.observedAt,
    evidenceHash: envelope.evidenceHash,
  };
}
