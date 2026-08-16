import { searchPublicIntelligence } from "@/lib/public-intelligence.mjs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const result = await searchPublicIntelligence({ query: url.searchParams.get("q") || "", timespan: url.searchParams.get("timespan") || "7d" });
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Public intelligence lookup failed." }, { status: 502 });
  }
}

