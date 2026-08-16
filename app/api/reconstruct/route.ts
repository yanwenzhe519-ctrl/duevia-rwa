import { reconstructAssetState } from "@/lib/reconstruction-engine.mjs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "A reconstruction input object is required." }, { status: 400 });
  try {
    const result = reconstructAssetState(body as Parameters<typeof reconstructAssetState>[0]);
    return Response.json({ ok: true, capsule: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Reconstruction failed." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}

