"use client";

import { useState } from "react";

type EventRow = { title: string; detail: string; tone: "ok" | "warn" | "ai" | "chain" };

const initialEvents: EventRow[] = [
  { title: "Servicer heartbeat received", detail: "Primary servicer · 14 Aug 2026 · 09:00 UTC", tone: "ok" },
  { title: "Recovery capsule sealed", detail: "18 assets · balance root 0x8a…4c1", tone: "chain" },
];

export default function ContinuityAgent({ onPublishState }: { onPublishState?: () => Promise<void> }) {
  const [running, setRunning] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [status, setStatus] = useState<"active" | "recovery" | "restored">("active");
  const [notice, setNotice] = useState("Primary servicer is within its data SLA.");
  const [aiMode, setAiMode] = useState<"pending" | "model-grounded" | "grounded-fallback">("pending");
  const [aiSummary, setAiSummary] = useState("");

  const simulateFailure = async () => {
    setRunning(true);
    setRecovered(false);
    setAiMode("pending");
    setAiSummary("");
    setStatus("recovery");
    setNotice("No heartbeat received. Duevia is protecting the pool before reconstructing state.");
    setEvents((current) => [...current, { title: "Heartbeat SLA breached", detail: "72 hours without a signed servicer update", tone: "warn" }]);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    setEvents((current) => [...current, { title: "X Layer circuit breaker armed", detail: "New issuance and pool deposits are now blocked", tone: "chain" }]);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    let summary = "Reconciled the last signed capsule with 3 onchain payment events; 1 exception requires successor review.";
    let mode: "model-grounded" | "grounded-fallback" = "grounded-fallback";
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Prepare a concise recovery plan after the primary RWA servicer missed its 72-hour heartbeat SLA.",
          context: {
            pool: "Receivables pool RCV-018",
            outstanding: "420,000 USDT",
            assets: 18,
            lastSignedCapsuleHoursAgo: 72,
            onchainPaymentsAfterCapsule: 3,
            unresolvedExceptions: 1,
            enforcedState: "New issuance and deposits paused on X Layer",
          },
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

  const restore = async () => {
    setRunning(true);
    setNotice("Submitting a new recovery attestation to the X Layer registry…");
    try {
      await onPublishState?.();
      setEvents((current) => [...current, { title: "Successor attestor authorized", detail: "Recovery root published · old servicer remains paused", tone: "chain" }]);
      setStatus("restored");
      setNotice("Recovery complete. The pool is operating from a verified successor state.");
    } catch {
      setNotice("Connect a wallet and deploy a Duevia registry to publish the recovery state.");
    } finally {
      setRunning(false);
    }
  };

  return <section className="continuity-view">
    <div className="continuity-hero">
      <div><span className="agent-kicker"><i /> DUEVIA CONTINUITY AGENT</span><h2>Keep RWA assets<br />operable when teams fail.</h2><p>AI reconstructs the latest asset state when a servicer goes offline. X Layer pauses unsafe actions, preserves the recovery proof, and hands operations to an authorized successor.</p></div>
      <div className="continuity-status-card"><span>POOL STATUS</span><strong className={status}>{status === "active" ? "ACTIVE" : status === "recovery" ? "RECOVERY REQUIRED" : "RESTORED"}</strong><small>Receivables pool · 18 assets · 420,000 USDT outstanding</small><div className="heartbeat"><i className={status === "active" ? "live" : "dead"} /><span>{status === "active" ? "Primary servicer heartbeat healthy" : status === "recovery" ? "Primary servicer offline" : "Successor state verified"}</span></div></div>
    </div>

    <div className="continuity-actions"><div><span className="section-index">FAILOVER SIMULATION</span><h3>One failure. Three controlled actions.</h3><p>{notice}</p></div><div className="continuity-buttons"><button className="run-check" type="button" onClick={simulateFailure} disabled={running || status === "recovery"}>{running ? "Agent working…" : "Simulate servicer outage"}<span>→</span></button><button className="anchor-button" type="button" onClick={restore} disabled={!recovered || running}>{running ? "Waiting…" : "Authorize recovery on X Layer"}<span>→</span></button></div></div>

    <div className="continuity-grid"><section className="continuity-events"><div className="panel-title"><div><span>EVENT LOG</span><h3>What actually happened</h3></div><b>{events.length} events</b></div><div className="event-list">{events.map((event, index) => <article key={`${event.title}-${index}`}><i className={event.tone}>{event.tone === "ai" ? "✦" : event.tone === "chain" ? "D" : event.tone === "warn" ? "!" : "✓"}</i><div><strong>{event.title}</strong><small>{event.detail}</small></div><em>{index === events.length - 1 && running ? "RUNNING" : "RECORDED"}</em></article>)}</div></section>
      <aside className="recovery-panel"><span className="proof-label">AI RECOVERY PLAN · {aiMode === "model-grounded" ? "AI MODEL LIVE" : aiMode === "grounded-fallback" ? "DETERMINISTIC FALLBACK" : "READY"}</span><h3>Evidence becomes<br />a handoff.</h3><p>{aiSummary || "AI maps the last signed snapshot, chain events, and repayment rules. Money math stays deterministic; humans approve the permission change."}</p><div className="recovery-checks"><div><i>✓</i><span>18 assets resolved<small>Last capsule · 72h old</small></span></div><div><i>✓</i><span>3 payments reconciled<small>Onchain event stream</small></span></div><div><i>!</i><span>1 unresolved exception<small>Requires successor review</small></span></div></div><small className="proof-note">Raw borrower data stays encrypted offchain. X Layer receives only the recovery root, policy, status, and validity window.</small></aside></div>
  </section>;
}
