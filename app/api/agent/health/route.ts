export function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return Response.json({
    ok: configured,
    configured,
    readiness: configured ? "CONFIGURED_UNVERIFIED" : "UNAVAILABLE",
    provider: configured ? "openai-compatible" : null,
    model: configured ? (process.env.OPENAI_MODEL || "gpt-5-mini") : null,
    mode: configured ? "configured-unverified" : "grounded-fallback",
    message: configured ? "AI connector is configured; model quota and inference are not probed by this health endpoint." : "AI model connector is not configured.",
  }, { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
