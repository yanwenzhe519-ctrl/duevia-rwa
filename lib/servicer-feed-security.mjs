function canonicalPayload(feed) {
  const unsigned = Object.fromEntries(Object.entries(feed).filter(([key]) => key !== "signature"));
  const sort = (value) => {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
    return value;
  };
  return JSON.stringify(sort(unsigned));
}

export async function verifyServicerFeedSignature(feed, secret) {
  if (!secret) throw new Error("SERVICER_FEED_HMAC_SECRET is not configured.");
  if (typeof feed?.signature !== "string" || !feed.signature.startsWith("hmac-sha256:")) {
    throw new Error("Servicer feed signature must use hmac-sha256.");
  }
  const received = feed.signature.slice("hmac-sha256:".length);
  if (!/^[0-9a-f]{64}$/i.test(received)) throw new Error("Servicer feed signature is invalid.");
  const bytes = new TextEncoder().encode(secret);
  const data = new TextEncoder().encode(canonicalPayload(feed));
  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (expected.length !== received.length || expected.toLowerCase() !== received.toLowerCase()) throw new Error("Servicer feed signature is invalid.");
  return true;
}

export function canonicalServicerFeedPayload(feed) {
  return canonicalPayload(feed);
}
