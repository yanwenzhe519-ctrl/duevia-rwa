"use client";

import { useRef, useState } from "react";

type EventRow = { title: string; detail: string; tone: "ok" | "warn" | "ai" | "chain" };
type FeedContext = { poolId: string; source: string; capturedAt: string; heartbeat: string; stale: boolean; ageHours: number; assetCount: number; paymentCount: number; totalOutstanding: number; eligibleOutstanding: number; policyState: string; alerts: Array<{ code: string; severity: string; assetCount: number }> };
type RecoveryCapsule = { schema: string; recoveryRoot: string; state: string; incidentId: string; totals: { assetCount: number; reconstructedOutstanding: number; conflictCount: number; highConfidenceAssets: number }; assets: Array<{ assetId: string; status: string; reconstructedOutstanding: number; confidence: string; conflicts: Array<{ code: string }> }> };

const initialEvents: EventRow[] = [
  { title: "Servicer heartbeat received", detail: "Primary servicer · 14 Aug 2026 · 09:00 UTC", tone: "ok" },
  { title: "Recovery capsule sealed", detail: "18 assets · balance root 0x8a…4c1", tone: "chain" },
];

export default function ContinuityAgent({
  onPublishSuspended,
  onPublishVerified,
}: {
  onPublishSuspended?: () => Promise<string>;
  onPublishVerified?: (previousAttestationId: string) => Promise<string>;
}) {
  const [running, setRunning] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [status, setStatus] = useState<"active" | "recovery" | "restored">("active");
  const [notice, setNotice] = useState("Primary servicer is within its data SLA.");
  const [aiMode, setAiMode] = useState<"pending" | "model-grounded" | "grounded-fallback">("pending");
  const [aiSummary, setAiSummary] = useState("");
  const [suspendedAttestationId, setSuspendedAttestationId] = useState("");
  const [feedContext, setFeedContext] = useState<FeedContext | null>(null);
  const [recoveryCapsule, setRecoveryCapsule] = useState<RecoveryCapsule | null>(null);
  const feedInput = useRef<HTMLInputElement>(null);

  const loadSignedFeed = async (file: File) => {
    setRunning(true);
    try {
      const response = await fetch("/api/servicer-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text() });
      const data = await response.json() as { error?: string; sanitizedContext?: FeedContext; recoveryCapsule?: RecoveryCapsule };
      if (!response.ok || !data.sanitizedContext) throw new Error(data.error || "Feed rejected");
      const context = data.sanitizedContext;
      setFeedContext(context);
      setRecoveryCapsule(data.recoveryCapsule || null);
      setEvents((current) => [...current, { title: "Signed servicer feed verified", detail: `${context.source} · ${context.assetCount} assets`, tone: "ok" }]);
      setNotice(`Verified ${file.name}. Policy state: ${context.policyState.toUpperCase()}.`);
    } catch (error) {
      setNotice(`Signed feed rejected: ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    } finally {
      setRunning(false);
    }
  };

  const simulateFailure = async () => {
    setRunning(true);
    setRecovered(false);
    setSuspendedAttestationId("");
    setAiMode("pending");
    setAiSummary("");
    setStatus("recovery");
    setNotice("No heartbeat received. Duevia is protecting the pool before reconstructing state.");
    setEvents((current) => [...current, { title: "Heartbeat SLA breached", detail: feedContext ? `${feedContext.ageHours.toFixed(1)} hours · ${feedContext.source}` : "72 hours · labelled demo feed", tone: "warn" }]);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    setEvents((current) => [...current, { title: "X Layer circuit breaker armed", detail: "New issuance and pool deposits are now blocked", tone: "chain" }]);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    if (!recoveryCapsule) {
      try {
        const response = await fetch("/api/reconstruct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          snapshot: { poolId: "RCV-018", source: "last-trusted-capsule", capturedAt: new Date(Date.now() - 72 * 3_600_000).toISOString(), assets: [{ assetId: "INV-001", invoiceId: "INV-001", debtor: "Demo buyer", faceValue: 100000, outstanding: 100000, documentHash: "demo-root-001" }, { assetId: "INV-002", invoiceId: "INV-002", debtor: "Demo buyer", faceValue: 80000, outstanding: 80000, documentHash: "demo-root-002" }] },
          payments: [{ paymentId: "CHAIN-PAY-001", invoiceId: "INV-001", amount: 10000, paidAt: new Date(Date.now() - 24 * 3_600_000).toISOString() }],
          chainEvents: [{ eventId: "X-LAYER-PAYMENT-001", invoiceId: "INV-001", txHash: "0xdemo" }], incident: { servicerId: "primary-servicer" },
        }) });
        const data = await response.json() as { capsule?: RecoveryCapsule };
        if (response.ok && data.capsule) setRecoveryCapsule(data.capsule);
      } catch { /* AI plan and deterministic controls remain available if reconstruction API is unavailable. */ }
    }
    let summary = "Reconciled the last signed capsule with 3 onchain payment events; 1 exception requires successor review.";
    let mode: "model-grounded" | "grounded-fallback" = "grounded-fallback";
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Prepare a concise recovery plan after the primary RWA servicer missed its 72-hour heartbeat SLA.",
          context: { ...(feedContext || { pool: "Receivables pool RCV-018", outstanding: "420,000 USDT", assets: 18, lastSignedCapsuleHoursAgo: 72, onchainPaymentsAfterCapsule: 3, unresolvedExceptions: 1, enforcedState: "New issuance and deposits paused on X Layer", sourceMode: "labelled-demo" }), recoveryCapsule },
        }),
      });
      const data = await response.json() as { answer?: string; mode?: "model-grounded" };
      if (response.ok && data.answer) {
        summary = data.answer;
        mode = "model-grounded";
      }
    } catch {
      // The deterministic plan remains available when the model connector is offline.
    }
    setAiMode(mode);
    setAiSummary(summary);
    setEvents((current) => [...current, { title: "AI recovery plan prepared", detail: summary.slice(0, 150), tone: "ai" }]);
    setNotice("Recovery plan is ready. Review the reconstructed state before authorizing the handoff.");
    setRunning(false);
    setRecovered(true);
  };

  const suspendOnchain = async () => {
    setRunning(true);
    setNotice("Publishing the SUSPENDED safety state to the X Layer registry…");
    try {
      if (!onPublishSuspended) throw new Error("Suspension publisher unavailable");
      const attestationId = await onPublishSuspended();
      setSuspendedAttestationId(attestationId);
      setEvents((current) => [...current, { title: "SUSPENDED state confirmed", detail: "Unsafe pool operations remain blocked on X Layer", tone: "chain" }]);
      setNotice("The pool is suspended onchain. The successor may now publish a linked VERIFIED state.");
    } catch {
      setNotice("Connect the authorized wallet and registry to publish the SUSPENDED state.");
    } finally {
      setRunning(false);
    }
  };

  const verifySuccessor = async () => {
    setRunning(true);
    setNotice("Publishing the successor VERIFIED attestation to X Layer…");
    try {
      if (!onPublishVerified || !suspendedAttestationId) throw new Error("Suspended predecessor required");
      await onPublishVerified(suspendedAttestationId);
      setEvents((current) => [...current, { title: "Successor state verified", detail: "Linked VERIFIED attestation confirmed · eligible operations restored", tone: "chain" }]);
      setStatus("restored");
      setNotice("Recovery complete. The pool now operates from a linked VERIFIED successor state.");
    } catch {
      setNotice("The VERIFIED successor state was not published. The pool remains safely suspended.");
    } finally {
      setRunning(false);
    }
  };

  return <section className="continuity-view">
    <div className="continuity-hero">
      <div><span className="agent-kicker"><i /> DUEVIA CONTINUITY AGENT</span><h2>Keep RWA assets<br />operable when teams fail.</h2><p>AI reconstructs the latest asset state when a servicer goes offline. X Layer pauses unsafe actions, preserves the recovery proof, and hands operations to an authorized successor.</p></div>
      <div className="continuity-status-card"><span>POOL STATUS</span><strong className={status}>{status === "active" ? "ACTIVE" : status === "recovery" ? "RECOVERY REQUIRED" : "RESTORED"}</strong><small>{feedContext ? `${feedContext.poolId} · ${feedContext.assetCount} assets · ${feedContext.totalOutstanding.toLocaleString()} outstanding` : "Receivables pool · 18 assets · 420,000 USDT outstanding"}</small><div className="heartbeat"><i className={status === "active" ? "live" : "dead"} /><span>{status === "active" ? (feedContext ? `${feedContext.source} feed verified` : "Primary servicer heartbeat healthy") : status === "recovery" ? "Primary servicer offline" : "Successor state verified"}</span></div></div>
    </div>

    <div className="continuity-actions"><div><span className="section-index">FAILOVER CONTROL · {feedContext ? "SIGNED FEED" : "LABELLED DEMO"}</span><h3>Detect, suspend, verify, resume.</h3><p>{notice}</p></div><div className="continuity-buttons"><input ref={feedInput} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && loadSignedFeed(event.target.files[0])} /><button className="upload-package" type="button" onClick={() => feedInput.current?.click()} disabled={running}>Load signed feed</button><button className="run-check" type="button" onClick={simulateFailure} disabled={running || status === "recovery"}>{running ? "Agent working…" : "Simulate servicer outage"}<span>→</span></button><button className="anchor-button" type="button" onClick={suspendOnchain} disabled={!recovered || Boolean(suspendedAttestationId) || running}>{suspendedAttestationId ? "SUSPENDED on X Layer" : "Publish SUSPENDED"}<span>→</span></button><button className="anchor-button" type="button" onClick={verifySuccessor} disabled={!suspendedAttestationId || running || status === "restored"}>{status === "restored" ? "VERIFIED on X Layer" : "Publish successor VERIFIED"}<span>→</span></button></div></div>

    <div className="continuity-grid"><section className="continuity-events"><div className="panel-title"><div><span>EVENT LOG</span><h3>What actually happened</h3></div><b>{events.length} events</b></div><div className="event-list">{events.map((event, index) => <article key={`${event.title}-${index}`}><i className={event.tone}>{event.tone === "ai" ? "✦" : event.tone === "chain" ? "D" : event.tone === "warn" ? "!" : "✓"}</i><div><strong>{event.title}</strong><small>{event.detail}</small></div><em>{index === events.length - 1 && running ? "RUNNING" : "RECORDED"}</em></article>)}</div>{recoveryCapsule && <div className="recovery-capsule"><div><span>RECOVERY CAPSULE · {recoveryCapsule.state}</span><strong>{recoveryCapsule.totals.assetCount} assets · {recoveryCapsule.totals.reconstructedOutstanding.toLocaleString()} reconstructed outstanding</strong><small>Root {recoveryCapsule.recoveryRoot.slice(0, 22)}… · {recoveryCapsule.totals.conflictCount} conflicts · {recoveryCapsule.totals.highConfidenceAssets} higher-confidence assets</small></div><code>{recoveryCapsule.assets.slice(0, 4).map((asset) => `${asset.assetId}: ${asset.status} / ${asset.confidence}`).join("\n")}</code></div>}</section>
      <aside className="recovery-panel"><span className="proof-label">AI RECOVERY PLAN · {aiMode === "model-grounded" ? "AI MODEL LIVE" : aiMode === "grounded-fallback" ? "DETERMINISTIC FALLBACK" : "READY"}</span><h3>Evidence becomes<br />a handoff.</h3><p>{aiSummary || "AI maps the last signed snapshot, chain events, and repayment rules. Money math stays deterministic; humans approve the permission change."}</p><div className="recovery-checks"><div><i>✓</i><span>{feedContext?.assetCount ?? 18} assets resolved<small>Snapshot · {feedContext ? `${feedContext.ageHours.toFixed(1)}h old` : "72h demo"}</small></span></div><div><i>✓</i><span>{feedContext?.paymentCount ?? 3} payments reconciled<small>Signed payment records</small></span></div><div><i>!</i><span>{feedContext?.alerts.length ?? 1} exception(s)<small>Deterministic policy result</small></span></div></div><small className="proof-note">Raw borrower data stays encrypted offchain. X Layer receives only the recovery root, policy, status, and validity window.</small></aside></div>
  </section>;
}
