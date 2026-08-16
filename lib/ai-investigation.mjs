const arrays = ["facts", "inferences", "missingEvidence", "recommendedActions"];

export function parseModelJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI result did not contain a JSON object.");
  return JSON.parse(raw.slice(start, end + 1));
}

export function modelResponseObject(output) {
  const response = output && typeof output === "object" && "response" in output ? output.response : output;
  if (response && typeof response === "object" && !Array.isArray(response)) return response;
  return parseModelJson(response);
}

export function failedInvestigation(incidentId, error) {
  return {
    schema: "duevia.ai-investigation/v1",
    incidentId: incidentId || null,
    summary: "The model did not produce a valid structured investigation. Human review is required.",
    riskLevel: "HIGH",
    facts: [],
    inferences: [],
    missingEvidence: [{ item: "Valid structured AI output", impact: String(error || "The investigation could not be verified.").slice(0, 500) }],
    recommendedActions: [{ action: "Keep the incident in review and block automatic suspension", reason: "Unverified model output cannot satisfy the execution policy.", requiresApproval: true }],
  };
}

export function collectEvidenceIds(value, result = new Set()) {
  if (Array.isArray(value)) for (const item of value) collectEvidenceIds(item, result);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
    if (["evidenceId", "observationId", "paymentId", "eventId", "transactionHash", "recoveryRoot", "snapshotHash"].includes(key) && typeof item === "string" && item) result.add(item);
    collectEvidenceIds(item, result);
  }
  return result;
}

export function validateInvestigation(candidate, evidenceIds) {
  const violations = [];
  if (!candidate || typeof candidate !== "object") return { valid: false, violations: ["Investigation must be an object."] };
  if (candidate.schema !== "duevia.ai-investigation/v1") violations.push("Unsupported investigation schema.");
  if (typeof candidate.summary !== "string" || !candidate.summary.trim() || candidate.summary.length > 1200) violations.push("summary must contain 1-1200 characters.");
  if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(candidate.riskLevel)) violations.push("riskLevel is invalid.");
  for (const field of arrays) if (!Array.isArray(candidate[field])) violations.push(`${field} must be an array.`);
  if (Array.isArray(candidate.facts) && candidate.facts.length === 0) violations.push("facts must contain at least one cited claim.");
  const allowed = new Set(evidenceIds || []);
  for (const [index, fact] of (Array.isArray(candidate.facts) ? candidate.facts : []).entries()) {
    if (!fact || typeof fact.claim !== "string" || !fact.claim.trim()) violations.push(`facts[${index}] has no claim.`);
    if (!Array.isArray(fact.evidenceIds) || !fact.evidenceIds.length) violations.push(`facts[${index}] has no evidence citation.`);
    for (const id of fact.evidenceIds || []) if (!allowed.has(id)) violations.push(`facts[${index}] cites unknown evidence ${id}.`);
  }
  for (const [index, action] of (Array.isArray(candidate.recommendedActions) ? candidate.recommendedActions : []).entries()) {
    if (!action || typeof action.action !== "string" || !action.action.trim()) violations.push(`recommendedActions[${index}] has no action.`);
    if (/(verify|resume|transfer|write.?down|pay|withdraw|liquidat|suspend|freeze|block)/i.test(String(action?.action || "")) && action?.requiresApproval !== true) violations.push(`recommendedActions[${index}] is material and must require approval.`);
  }
  return { valid: violations.length === 0, violations };
}

export function validateModelVerifier(candidate) {
  if (!candidate || typeof candidate !== "object" || typeof candidate.valid !== "boolean") return { valid: false, violations: ["Verifier response is malformed."] };
  const unsupportedClaims = Array.isArray(candidate.unsupportedClaims) ? candidate.unsupportedClaims.map(String) : [];
  return { valid: candidate.valid && unsupportedClaims.length === 0, violations: unsupportedClaims, reason: String(candidate.reason || "") };
}
