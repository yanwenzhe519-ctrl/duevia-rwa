"use client";

import { useCallback, useEffect, useState } from "react";

type Project = { pool_id: string; project_name?: string; contract_address?: string; last_state?: string };
type Checkpoint = { checkpoint_id: string; checkpoint_hash: string; confirmation_block: string; created_at: string };
type Redemption = { request_id: string; account: string; amount: string; governance_status: string; execution_status: string };
type CheckpointAccount = { account: string; checkpoint_id: string; principal: string; yield_amount: string; pending_redemption: string; updated_at: string };
type AccountDiff = { account: string; previous: Record<string, string>; reconstructed: Record<string, string>; stateDiff: Record<string, string>; evidenceRefs: string[]; confidence: number };
type Trace = { run_id: string; model: string; verifier_model: string; status: string; capsule_hash?: string; created_at: string; trace?: { reconstruction?: { candidates?: Array<{ candidateId: string; accounts: AccountDiff[] }> }; counterEvidence?: { valid?: boolean }; deterministicValidation?: { valid?: boolean } } };

export default function TakeoverRuntime() {
  const [project, setProject] = useState<Project | null>(null);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [checkpointAccount, setCheckpointAccount] = useState<CheckpointAccount | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [incident, setIncident] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "live" | "empty" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const projectsResponse = await fetch("/api/watchdog/projects", { cache: "no-store" });
      if (!projectsResponse.ok) throw new Error(`Project registry returned HTTP ${projectsResponse.status}.`);
      const projectsPayload = await projectsResponse.json() as { projects?: Project[] };
      const selected = projectsPayload.projects?.find((item) => item.pool_id === "DUEVIA-RCV-018") || null;
      if (!selected) { setProject(null); setState("empty"); return; }
      setProject(selected);
      const root = `/api/rwa/${encodeURIComponent(selected.pool_id)}`;
      const [statusResponse, checkpointResponse, redemptionResponse, traceResponse, accountResponse] = await Promise.all([fetch(`${root}/status`, { cache: "no-store" }), fetch(`${root}/checkpoints`, { cache: "no-store" }), fetch(`${root}/redemptions`, { cache: "no-store" }), fetch(`${root}/decision-trace`, { cache: "no-store" }), fetch(`${root}/accounts`, { cache: "no-store" })]);
      if (![statusResponse, checkpointResponse, redemptionResponse, traceResponse, accountResponse].every((response) => response.ok)) throw new Error("The takeover runtime is not initialized. Apply D1 migration 0008 before enabling this panel.");
      const statusPayload = await statusResponse.json() as { incident?: Record<string, unknown> | null };
      const checkpointPayload = await checkpointResponse.json() as { checkpoints?: Checkpoint[] };
      const redemptionPayload = await redemptionResponse.json() as { redemptions?: Redemption[] };
      const tracePayload = await traceResponse.json() as { traces?: Trace[] };
      const accountPayload = await accountResponse.json() as { accounts?: CheckpointAccount[] };
      setIncident(statusPayload.incident || null);
      setCheckpoint(checkpointPayload.checkpoints?.[0] || null);
      setRedemptions(redemptionPayload.redemptions || []);
      setTrace(tracePayload.traces?.[0] || null);
      setCheckpointAccount(accountPayload.accounts?.[0] || null);
      setState("live");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The runtime could not be loaded.");
      setState("error");
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const candidate = trace?.trace?.reconstruction?.candidates?.[0];
  const account = candidate?.accounts?.[0];

  return <section className="takeover-runtime" aria-live="polite">
    <header className="takeover-runtime-head"><div><h3>Service takeover runtime</h3><p>AI reconstructs. Governance authorizes. X Layer executes.</p></div><button type="button" onClick={() => void load()} disabled={state === "loading"}>{state === "loading" ? "Refreshing" : "Refresh runtime"}</button></header>
    {state === "empty" && <div className="runtime-empty"><strong>No registered RWA contract</strong><span>Register an enabled project with an X Layer contract address before checkpoints and takeover state can appear.</span></div>}
    {state === "error" && <div className="runtime-empty runtime-error"><strong>Runtime unavailable</strong><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div>}
    {state === "loading" && <div className="runtime-empty"><strong>Loading verified runtime state</strong><span>Reading the project registry, checkpoint ledger, redemption queue, and AI decision trace.</span></div>}
    {state === "live" && project && <><div className="takeover-summary">
      <div><span>RWA PROJECT</span><strong>{project.project_name || project.pool_id}</strong><code>{project.contract_address}</code></div>
      <div><span>INCIDENT STATE</span><strong>{String(incident?.state || project.last_state || "ACTIVE")}</strong><small>{incident ? String(incident.incident_id || "Incident recorded") : "Primary servicer path"}</small></div>
      <div><span>LAST CHECKPOINT</span><strong>{checkpoint ? `Block ${checkpoint.confirmation_block}` : "Awaiting first checkpoint"}</strong><code>{checkpoint?.checkpoint_hash || "No checkpoint hash"}</code></div>
      <div><span>REDEMPTION QUEUE</span><strong>{redemptions.length}</strong><small>{redemptions.length ? `${redemptions.filter((item) => item.execution_status === "QUEUED").length} queued` : "No pending requests"}</small></div>
    </div><div className="takeover-detail"><section><div className="runtime-section-title"><h4>Account state difference</h4><span>{candidate?.candidateId || "NO VALIDATED CANDIDATE"}</span></div>
      {account ? <div className="state-diff"><code>{account.account}</code>{(["principal", "yield", "pendingRedemption"] as const).map((field) => <div key={field}><span>{field}</span><b>{account.previous[field]}</b><i>→</i><b>{account.reconstructed[field]}</b><em>{account.stateDiff[`${field === "pendingRedemption" ? "redemption" : field}Delta`]}</em></div>)}<small>{account.evidenceRefs.length} evidence references · confidence {(account.confidence * 100).toFixed(0)}%</small></div> : checkpointAccount ? <div className="state-diff"><code>{checkpointAccount.account}</code>{(["principal", "yield_amount", "pending_redemption"] as const).map((field) => <div key={field}><span>{field === "yield_amount" ? "yield" : field === "pending_redemption" ? "pendingRedemption" : field}</span><b>{checkpointAccount[field]}</b><i>·</i><b>CHECKPOINT</b><em>AI REVIEW PENDING</em></div>)}<small>Confirmed checkpoint state · updated {new Date(checkpointAccount.updated_at).toLocaleString()}</small></div> : <div className="runtime-empty compact"><strong>No account state recorded yet</strong><span>A validated AI candidate appears after both models return schema-valid output.</span></div>}
    </section><section><div className="runtime-section-title"><h4>Decision trace</h4><span>{trace?.status || "AWAITING MODEL RUN"}</span></div><dl className="trace-facts">
      <div><dt>Primary model</dt><dd>{trace?.model || "Not run"}</dd></div><div><dt>Counter-evidence model</dt><dd>{trace?.verifier_model || "Not run"}</dd></div><div><dt>Deterministic rules</dt><dd>{trace?.trace?.deterministicValidation?.valid ? "PASSED" : "NOT PASSED"}</dd></div><div><dt>Adversarial verification</dt><dd>{trace?.trace?.counterEvidence?.valid ? "PASSED" : "NOT PASSED"}</dd></div><div><dt>Recovery Capsule</dt><dd><code>{trace?.capsule_hash || "Not generated"}</code></dd></div>
    </dl></section></div></>}
  </section>;
}
