import { evaluateWatchdog } from "@/lib/continuity-watchdog.mjs";

export async function POST(request: Request) {
  try {
    const observation = await request.json();
    const result = evaluateWatchdog(observation);
    return Response.json({ ok: true, incident: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Watchdog evaluation failed." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}

