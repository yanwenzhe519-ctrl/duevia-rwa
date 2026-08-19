"use client";

import { useEffect, useMemo, useState } from "react";

type Investigation = {
  investigationId?: string;
  incidentId?: string;
  createdAt?: string;
  model?: string;
  valid?: boolean;
  summary?: string;
  riskLevel?: string;
  facts?: Array<{ claim?: string; evidenceIds?: string[] }>;
  factsCount?: number;
  missingEvidence?: Array<{ item?: string; impact?: string }>;
  missingEvidenceCount?: number;
  recommendedActions?: Array<{ action?: string; reason?: string; requiresApproval?: boolean }>;
  verifier?: { valid?: boolean; reason?: string };
};

type Capsule = {
  recoveryRoot?: string;
  incidentId?: string;
  poolId?: string;
  state?: string;
  createdAt?: string;
  metrics?: {
    assetCount?: number;
    reconstructedOutstanding?: number;
    conflictCount?: number;
    highConfidenceAssets?: number;
    sourceCapturedAt?: string | null;
    independentEvidenceCount?: number;
    requiredApprovalCount?: number;
  };
};

type Evidence = {
  generatedAt?: string;
  projects?: Array<{ pool_id?: string; last_state?: string; last_heartbeat_at?: string; shadow_mode?: number }>;
  incidents?: Array<{ incident_id?: string; state?: string; opened_at?: string; updated_at?: string; recovery_root?: string }>;
  keeperRuns?: Array<{ started_at?: string; finished_at?: string; status?: string; to_block?: string; observations?: number }>;
  aiInvestigations?: Investigation[];
  recoveryCapsules?: Capsule[];
  runtimeEvidenceAvailable?: boolean;
};

type Runtime = { chainId?: number; latestRunAt?: string; status?: string; failover?: { status?: string } };

type ModuleData = { evidence: Evidence | null; runtime: Runtime | null; error: boolean; updatedAt: string | null };

const emptyData: ModuleData = { evidence: null, runtime: null, error: false, updatedAt: null };

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

function formatTime(value?: string | null) {
  if (!value) return "Awaiting sample";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown time" : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortHash(value?: string) {
  if (!value) return "Awaiting root";
  return value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

function riskClass(value?: string) {
  return `trace-risk risk-${String(value || "unknown").toLowerCase()}`;
}

export function PublicRecoveryModules() {
  const [data, setData] = useState<ModuleData>(emptyData);
  const [simulationStep, setSimulationStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [evidence, runtime] = await Promise.all([
          readJson<Evidence>("/api/evidence"),
          readJson<Runtime>("/api/operations/health"),
        ]);
        if (!cancelled) setData({ evidence, runtime, error: false, updatedAt: new Date().toISOString() });
      } catch {
        if (!cancelled) setData((current) => ({ ...current, error: true }));
      }
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const evidence = data.evidence;
  const investigation = evidence?.aiInvestigations?.[0];
  const capsule = evidence?.recoveryCapsules?.[0];
  const project = evidence?.projects?.[0];
  const incident = evidence?.incidents?.[0];
  const keeper = evidence?.keeperRuns?.[0];
  const metrics = capsule?.metrics;
  const incidentState = incident?.state || project?.last_state || "MONITORING";
  const simulationStages = ["Detect outage", "Freeze unsafe actions", "Reconstruct state", "Await approval"];

  const timeline = useMemo(() => {
    const events = [
      project?.last_heartbeat_at && { time: project.last_heartbeat_at, label: "Signed heartbeat", detail: `${project.last_state || "MONITORING"} · ${project.shadow_mode ? "shadow feed" : "signed feed"}`, state: project.last_state || "MONITORING" },
      incident?.opened_at && { time: incident.opened_at, label: "Incident opened", detail: incident.state || "OUTAGE", state: "REVIEW" },
      keeper?.finished_at && { time: keeper.finished_at, label: "Keeper scan committed", detail: `${keeper.observations || 0} observations · block ${keeper.to_block || "--"}`, state: keeper.status || "OK" },
      investigation?.createdAt && { time: investigation.createdAt, label: "AI investigation stored", detail: `${investigation.model || "Workers AI"} · verifier ${investigation.verifier?.valid ? "valid" : "review"}`, state: investigation.riskLevel || "AI" },
      capsule?.createdAt && { time: capsule.createdAt, label: "Recovery capsule published", detail: `${capsule.state || "RECONSTRUCTED"} · root ${shortHash(capsule.recoveryRoot)}`, state: "ROOT" },
    ].filter(Boolean) as Array<{ time: string; label: string; detail: string; state: string }>;
    return events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [capsule, incident, investigation, keeper, project]);

  return <section className="public-recovery-modules" id="recovery">
    <div className="shell">
      <div className="section-heading-row public-modules-heading">
        <div><span className="section-index">PUBLIC RECOVERY TRACE / 05</span><h2>See what the system<br />actually decided.</h2></div>
        <p>These panels are fed by the deployed Worker, D1 Keeper records, Workers AI investigations, and public recovery capsule metadata. The page refreshes automatically every 30 seconds.</p>
      </div>
      <div className="public-module-grid">
        <article className="public-module incident-overview-module" id="incident">
          <div className="public-module-head"><span>00 / LATEST INCIDENT · 实时事故面板</span><b className={incidentState === "OUTAGE" || incidentState.includes("OUTAGE") ? "trace-review" : "trace-ok"}>{incidentState.replaceAll("_", " ")}</b></div>
          <div className="incident-overview-body"><div><small>POOL</small><strong>{project?.pool_id || "DUEVIA-RCV-018"}</strong><span>{project?.shadow_mode ? "Shadow feed · X Layer Testnet" : "Signed feed · X Layer Testnet"}</span></div><div><small>SERVICER HEARTBEAT</small><strong>{project?.last_heartbeat_at ? formatTime(project.last_heartbeat_at) : "Awaiting sample"}</strong><span>{incident?.updated_at ? `Incident updated ${formatTime(incident.updated_at)}` : "No open incident record"}</span></div><div><small>PROTECTION STATE</small><strong>{incidentState === "OUTAGE" || incidentState.includes("OUTAGE") ? "PAUSED" : "MONITORING"}</strong><span>Keeper {keeper?.status || "checking"} · chain {data.runtime?.chainId || 1952}</span></div><div><small>RECOVERY ROOT</small><strong>{shortHash(capsule?.recoveryRoot)}</strong><span>{capsule?.state || "Awaiting capsule"} · {metrics?.requiredApprovalCount ?? 0} approvals</span></div></div>
          <div className="incident-overview-foot"><span>{data.error ? "Public runtime reconnecting" : `D1 + Cron + AI · refreshed ${formatTime(data.updatedAt)}`}</span><a href="#activity">Open activity timeline <span>→</span></a></div>
        </article>

        <article className="public-module ai-trace-module" id="ai-trace">
          <div className="public-module-head"><span>01 / AI DECISION TRACE · AI 决策追踪</span><b className={investigation?.valid ? "trace-ok" : "trace-review"}>{investigation ? (investigation.valid ? "VERIFIED" : "REVIEW") : "AWAITING RUN"}</b></div>
          {investigation ? <>
            <div className="trace-summary"><span className={riskClass(investigation.riskLevel)}>{investigation.riskLevel || "UNKNOWN"} RISK</span><p>{investigation.summary}</p></div>
            <div className="trace-stats"><div><strong>{investigation.factsCount ?? investigation.facts?.length ?? 0}</strong><span>supported facts</span></div><div><strong>{investigation.missingEvidenceCount ?? investigation.missingEvidence?.length ?? 0}</strong><span>evidence gaps</span></div><div><strong>{investigation.recommendedActions?.length || 0}</strong><span>proposed actions</span></div></div>
            <div className="trace-evidence-list">{(investigation.facts || []).slice(0, 3).map((fact, index) => <div key={`${fact.claim}-${index}`}><i>F{index + 1}</i><span>{fact.claim}</span><small>{(fact.evidenceIds || []).slice(0, 2).join(" · ") || "context-root"}</small></div>)}</div>
            <div className="trace-footer"><span>Independent verifier: {investigation.verifier?.valid ? "valid" : "requires review"}</span><em>{formatTime(investigation.createdAt)} · {investigation.model || "Workers AI"}</em></div>
          </> : <div className="public-empty"><strong>No public AI investigation yet.</strong><span>The next Keeper recovery run will automatically create an investigation and verifier record.</span></div>}
        </article>

        <article className="public-module timeline-module" id="activity">
          <div className="public-module-head"><span>02 / INCIDENT ACTIVITY · 事故时间线</span><b>{data.error ? "RECONNECTING" : "LIVE"}</b></div>
          <div className="timeline-list public-timeline">{timeline.length ? timeline.map((event) => <div key={`${event.label}-${event.time}`}><time>{formatTime(event.time)}</time><span><strong>{event.label}</strong><small>{event.detail}</small></span><em>{event.state.replaceAll("_", " ")}</em></div>) : <div className="public-empty"><strong>Waiting for the first runtime event.</strong><span>Incident, Keeper, AI, and capsule events will appear here from public D1 evidence.</span></div>}</div>
          <div className="trace-footer"><span>Latest public sample</span><em>{formatTime(data.updatedAt || evidence?.generatedAt)}</em></div>
        </article>

        <article className="public-module diff-module" id="state-diff">
          <div className="public-module-head"><span>03 / RECOVERY STATE DIFF · 状态重建前后对比</span><b>SHADOW / TESTNET</b></div>
          <p className="module-note">A public metric diff, not a claim of legal ownership or real-world settlement.</p>
          <div className="state-diff-grid">
            <div><span>Last trusted snapshot</span><strong>{metrics?.sourceCapturedAt ? formatTime(metrics.sourceCapturedAt) : "Awaiting snapshot"}</strong><small>servicer evidence boundary</small></div>
            <div><span>AI reconstructed state</span><strong>{metrics ? `${metrics.assetCount ?? 0} assets` : "Awaiting capsule"}</strong><small>{metrics ? `${metrics.highConfidenceAssets ?? 0} high confidence · ${metrics.conflictCount ?? 0} conflicts` : "deterministic capsule metrics"}</small></div>
            <div><span>X Layer protected state</span><strong>{project?.last_state?.replaceAll("_", " ") || "MONITORING"}</strong><small>chain {data.runtime?.chainId || 1952} · {data.runtime?.failover?.status || "failover checking"}</small></div>
          </div>
          <div className="diff-root"><span>RECOVERY ROOT</span><code>{shortHash(capsule?.recoveryRoot)}</code><small>{metrics?.requiredApprovalCount ?? 0} approval records · {metrics?.independentEvidenceCount ?? 0} evidence groups</small></div>
        </article>

        <article className="public-module guardrails-module" id="guardrails">
          <div className="public-module-head"><span>04 / GUARDRAILS · 合约边界</span><b>ENFORCED</b></div>
          <p className="module-note">The model can recommend a path. Only policy, quorum, and an authorized successor can change the protected state.</p>
          <div className="guardrail-list"><div><i>01</i><span><strong>AI proposes</strong><small>facts · gaps · recovery plan</small></span><b>NO WRITE</b></div><div><i>02</i><span><strong>Governance approves</strong><small>successor · policy · permission</small></span><b>HUMAN</b></div><div><i>03</i><span><strong>X Layer enforces</strong><small>pause · attestation · resume</small></span><b>ONCHAIN</b></div></div>
          <div className="guardrail-note">Automatic broadcast is disabled in this testnet deployment. No AI result can move funds or bypass quorum.</div>
        </article>

        <article className="public-module simulation-module" id="simulation">
          <div className="public-module-head"><span>05 / RECOVERY SIMULATION · 恢复演练</span><b>SHADOW ONLY</b></div>
          <div className="simulation-copy"><div><h3>Rehearse the handoff path</h3><p>Run the deterministic sequence against the latest public incident state. This does not broadcast a transaction or change the pool.</p></div><button type="button" onClick={() => setSimulationStep((step) => (step + 1) % (simulationStages.length + 1))}>{simulationStep === simulationStages.length ? "Reset rehearsal" : simulationStep === 0 ? "Run rehearsal" : "Advance step"}<span>→</span></button></div>
          <div className="simulation-steps">{simulationStages.map((stage, index) => <div className={index < simulationStep ? "done" : index === simulationStep ? "active" : ""} key={stage}><i>{index < simulationStep ? "✓" : String(index + 1).padStart(2, "0")}</i><span><strong>{stage}</strong><small>{index === 0 ? "heartbeat SLA" : index === 1 ? "contract policy" : index === 2 ? "AI + verifier" : "multisig quorum"}</small></span></div>)}</div>
          <div className="simulation-status"><span>{simulationStep === simulationStages.length ? "Rehearsal complete · no transaction sent" : simulationStep === 0 ? "Ready · shadow mode" : `${simulationStages[simulationStep - 1]} complete`}</span><em>{simulationStep}/{simulationStages.length} steps</em></div>
        </article>

        <article className="public-module faq-module" id="faq">
          <div className="public-module-head"><span>06 / FAQ · 评审疑问</span><b>BOUNDARIES</b></div>
          <div className="faq-intro"><h3>Questions worth asking before you trust a recovery system.</h3><p>Short answers for reviewers, issuers, and successor servicers.</p></div>
          <div className="faq-list">
            <details><summary>Can Duevia recover real RWA ownership?</summary><p>No. It can reconstruct a bounded operational state from supplied evidence. Legal ownership, identity, servicing rights, and disputes still require the issuer, custodian, and human/legal review.</p></details>
            <details><summary>Can AI move money or bypass policy?</summary><p>No. AI proposes facts, risk, and approval-gated actions. Deterministic X Layer contracts and authorized governance control pause, resume, and successor permissions.</p></details>
            <details><summary>What does the Recovery Root prove?</summary><p>It commits to the recovery capsule version and its evidence-derived state. It does not prove that an offchain asset exists, that a borrower paid, or that a claim is legally enforceable.</p></details>
            <details><summary>Why does the page say Shadow / Testnet?</summary><p>This public deployment runs on X Layer testnet with shadow-mode demo records. It is not a mainnet custody system and must not be used to represent real TVL or production settlement.</p></details>
            <details><summary>Does raw borrower data go onchain?</summary><p>No. The public proof is a root, timestamps, state, and safe aggregate metrics. Sensitive source records remain offchain and are not returned by the public API.</p></details>
          </div>
        </article>
      </div>
      <div className="public-modules-footer"><span>{data.error ? "Public trace temporarily unavailable" : `Worker evidence refreshed ${formatTime(data.updatedAt)}`}</span><div><a href="/proof">Read public proof <span>→</span></a><a href="/app">Open DApp <span>→</span></a><a href="/api/evidence" target="_blank" rel="noreferrer">Inspect API <span>↗</span></a></div></div>
    </div>
  </section>;
}
