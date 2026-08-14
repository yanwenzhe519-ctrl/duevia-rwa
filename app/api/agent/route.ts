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
  if (!apiKey) return Response.json({ error: "AI model connector is not configured.", mode: "grounded-fallback" }, { status: 503 });

  const body = await request.json() as AgentRequest;
  const question = String(body.question || "").slice(0, 2000);
  const context = JSON.stringify(body.context || {}).slice(0, 30000);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      instructions: "You are Duevia, an RWA investigation agent. Answer only from the supplied structured evidence. Separate facts, inferences, missing evidence, and recommended actions. Never claim legal ownership, audit assurance, credit rating, or repayment certainty. Be concise and decision-oriented.",
      input: `Investigation request: ${question}\n\nStructured asset context:\n${context}`,
    }),
  });

  if (!response.ok) return Response.json({ error: "The configured AI model did not return a result.", mode: "grounded-fallback" }, { status: 502 });
  const data = await response.json() as Record<string, unknown>;
  const answer = extractText(data);
  if (!answer) return Response.json({ error: "The AI model returned an empty result.", mode: "grounded-fallback" }, { status: 502 });
  return Response.json({ answer, mode: "model-grounded" });
}
