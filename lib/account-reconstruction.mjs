import { createHash } from "node:crypto";

export const accountReconstructionSchema = {
  type: "object",
  properties: {
    schema: { const: "duevia.account-reconstruction/v1" },
    candidates: {
      type: "array", minItems: 2, maxItems: 4,
      items: {
        type: "object",
        properties: {
          candidateId: { type: "string" },
          accounts: {
            type: "array", minItems: 1,
            items: {
              type: "object",
              properties: {
                account: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
                previous: { $ref: "#/$defs/state" },
                reconstructed: { $ref: "#/$defs/state" },
                stateDiff: { $ref: "#/$defs/diff" },
                evidenceRefs: { type: "array", minItems: 1, items: { type: "string" } },
                assumptions: { type: "array", items: { type: "string" } },
                conflicts: { type: "array", items: { type: "string" } },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                status: { enum: ["PENDING_VALIDATION", "REJECTED"] },
              },
              required: ["account", "previous", "reconstructed", "stateDiff", "evidenceRefs", "assumptions", "conflicts", "confidence", "status"], additionalProperties: false,
            },
          },
        },
        required: ["candidateId", "accounts"], additionalProperties: false,
      },
    },
  },
  required: ["schema", "candidates"], additionalProperties: false,
  $defs: {
    state: { type: "object", properties: { principal: { type: "string", pattern: "^\\d+$" }, yield: { type: "string", pattern: "^\\d+$" }, pendingRedemption: { type: "string", pattern: "^\\d+$" } }, required: ["principal", "yield", "pendingRedemption"], additionalProperties: false },
    diff: { type: "object", properties: { principalDelta: { type: "string", pattern: "^-?\\d+$" }, yieldDelta: { type: "string", pattern: "^-?\\d+$" }, redemptionDelta: { type: "string", pattern: "^-?\\d+$" } }, required: ["principalDelta", "yieldDelta", "redemptionDelta"], additionalProperties: false },
  },
};

const integer = (value) => /^-?\d+$/.test(String(value));
const unsigned = (value) => /^\d+$/.test(String(value));
const delta = (before, after) => (BigInt(after) - BigInt(before)).toString();

export function evidenceCatalog(input) {
  const rows = Array.isArray(input?.evidence) ? input.evidence : [];
  return new Map(rows.filter((row) => row && typeof row.id === "string").map((row) => [row.id, row]));
}

export function validateAccountReconstruction(output, input, { minimumConfidence = 0.8 } = {}) {
  const errors = [];
  const catalog = evidenceCatalog(input);
  if (output?.schema !== "duevia.account-reconstruction/v1") errors.push("INVALID_SCHEMA");
  if (!Array.isArray(output?.candidates) || output.candidates.length < 2) errors.push("MULTIPLE_CANDIDATES_REQUIRED");
  const candidateIds = new Set();
  for (const candidate of output?.candidates || []) {
    if (!candidate?.candidateId || candidateIds.has(candidate.candidateId)) errors.push("DUPLICATE_CANDIDATE");
    candidateIds.add(candidate?.candidateId);
    const accounts = Array.isArray(candidate?.accounts) ? candidate.accounts : [];
    if (!accounts.length) errors.push("ACCOUNT_STATE_REQUIRED");
    const seen = new Set();
    for (const row of accounts) {
      const key = String(row?.account || "").toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(key)) errors.push("INVALID_ACCOUNT");
      if (seen.has(key)) errors.push("DUPLICATE_ACCOUNT");
      seen.add(key);
      for (const field of ["principal", "yield", "pendingRedemption"]) {
        if (!unsigned(row?.previous?.[field]) || !unsigned(row?.reconstructed?.[field])) errors.push(`INVALID_${field.toUpperCase()}`);
      }
      for (const field of ["principalDelta", "yieldDelta", "redemptionDelta"]) if (!integer(row?.stateDiff?.[field])) errors.push(`INVALID_${field.toUpperCase()}`);
      if (unsigned(row?.previous?.principal) && unsigned(row?.reconstructed?.principal) && row?.stateDiff?.principalDelta !== delta(row.previous.principal, row.reconstructed.principal)) errors.push("PRINCIPAL_NOT_CONSERVED");
      if (unsigned(row?.previous?.yield) && unsigned(row?.reconstructed?.yield) && row?.stateDiff?.yieldDelta !== delta(row.previous.yield, row.reconstructed.yield)) errors.push("YIELD_NOT_CONSERVED");
      if (unsigned(row?.previous?.pendingRedemption) && unsigned(row?.reconstructed?.pendingRedemption) && row?.stateDiff?.redemptionDelta !== delta(row.previous.pendingRedemption, row.reconstructed.pendingRedemption)) errors.push("REDEMPTION_NOT_CONSERVED");
      if (!Array.isArray(row?.evidenceRefs) || !row.evidenceRefs.length) errors.push("EVIDENCE_REQUIRED");
      for (const ref of row?.evidenceRefs || []) if (!catalog.has(ref)) errors.push("UNKNOWN_EVIDENCE_REF");
      if (Number(row?.confidence) < minimumConfidence) errors.push("LOW_CONFIDENCE");
      if (Array.isArray(row?.conflicts) && row.conflicts.length) errors.push("UNRESOLVED_CONFLICT");
    }
  }
  const uniqueErrors = [...new Set(errors)];
  return { valid: uniqueErrors.length === 0, errors: uniqueErrors, evidenceCount: catalog.size, candidateCount: output?.candidates?.length || 0 };
}

export function capsuleForReconstruction(projectId, incidentId, output, validation, verifier) {
  const payload = { schema: "duevia.recovery-capsule/v2", projectId, incidentId, reconstruction: output, deterministicValidation: validation, counterEvidenceVerification: verifier };
  const capsuleHash = `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
  return { ...payload, capsuleHash, executable: validation.valid && verifier?.valid === true };
}
