type AgentRequest = {
  question?: string;
  context?: unknown;
};

function extractText(response: Record<string, unknown>) {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) return Response.json({ error: "AI model connector is not configured.", mode: "grounded-fallback" }, { status: 503 });

  let body: AgentRequest;
  try {
    body = await request.json() as AgentRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON.", mode: "grounded-fallback" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
  if (!question) return Response.json({ error: "A non-empty investigation question is required.", mode: "grounded-fallback" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  let context = "{}";
  try {
    context = JSON.stringify(body.context || {});
  } catch {
    return Response.json({ error: "Structured context must be serializable JSON.", mode: "grounded-fallback" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  context = context.slice(0, 30000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        instructions: "You are Duevia, an RWA investigation agent. Answer only from the supplied structured evidence. Separate facts, inferences, missing evidence, and recommended actions. Never claim legal ownership, audit assurance, credit rating, or repayment certainty. Be concise and decision-oriented.",
        input: `Investigation request: ${question}\n\nStructured asset context:\n${context}`,
      }),
      signal: controller.signal,
    });
  } catch {
    return Response.json({ error: "The AI model connector timed out or is unavailable.", mode: "grounded-fallback" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) return Response.json({ error: "The configured AI model did not return a result.", mode: "grounded-fallback" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  const data = await response.json() as Record<string, unknown>;
  const answer = extractText(data);
  if (!answer) return Response.json({ error: "The AI model returned an empty result.", mode: "grounded-fallback" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return Response.json({ answer: answer.slice(0, 12000), mode: "model-grounded" }, { headers: { "Cache-Control": "no-store" } });
}
