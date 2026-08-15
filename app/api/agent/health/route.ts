export function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return Response.json({
    ok: configured,
    provider: configured ? "openai-compatible" : null,
    model: configured ? (process.env.OPENAI_MODEL || "gpt-5-mini") : null,
    mode: configured ? "model-grounded" : "grounded-fallback",
    message: configured ? "AI model connector is configured." : "AI model connector is not configured.",
  }, { headers: { "Cache-Control": "no-store" } });
}
