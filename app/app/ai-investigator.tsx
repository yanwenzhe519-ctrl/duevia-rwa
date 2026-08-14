"use client";

import { useMemo, useState } from "react";

type PortfolioReport = {
  poolId: string;
  poolName: string;
  state: string;
  metrics: Record<string, number>;
  alerts: Array<{ severity: string; code: string; title: string; action: string; assets: string[] }>;
  assets: Array<Record<string, unknown>>;
  concentration: Array<{ debtor: string; exposure: number; share: number }>;
  policy: Array<{ id: string; label: string; passed: boolean }>;
};

const prompts = [
  "Why should new issuance be suspended?",
  "Find signs of duplicate financing.",
  "Which evidence should an analyst request next?",
];

function groundedAnswer(question: string, report: PortfolioReport) {
  const top = report.alerts.slice(0, 3);
  const focus = question.toLowerCase();
  const relevant = focus.includes("duplicate")
    ? report.alerts.filter((alert) => alert.code.includes("DUPLICATE"))
    : focus.includes("evidence") || focus.includes("request")
      ? report.alerts.filter((alert) => alert.code.includes("STALE") || alert.code.includes("MISMATCH"))
      : top;
  const selected = relevant.length ? relevant.slice(0, 3) : top;
  const summary = report.state === "suspended"
    ? `Duevia recommends SUSPEND because ${report.metrics.highAlerts} high-severity control(s) are open. New issuance should remain blocked until the evidence and collateral eligibility failures are resolved.`
    : report.state === "review"
      ? "Duevia recommends HOLD. No automatic issuance should occur until the open exceptions receive human approval."
      : "Duevia recommends ALLOW under the current policy and validity window.";
  return { summary, findings: selected };
}

export default function AiInvestigator({ report, sourceName, onOpenPortfolio }: { report: PortfolioReport; sourceName: string; onOpenPortfolio: () => void }) {
  const [question, setQuestion] = useState("Investigate this RWA pool and decide whether new issuance should proceed.");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(-1);
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState<"model-grounded" | "grounded-fallback">("grounded-fallback");
  const [findings, setFindings] = useState(report.alerts.slice(0, 3));
  const graph = useMemo(() => {
    const debtors = report.concentration.slice(0, 3).map((item) => item.debtor);
    return [
      { type: "Pool", label: report.poolName, state: report.state },
      { type: "Originator", label: String(report.assets[0]?.originator || "Unknown originator"), state: "verified" },
      ...debtors.map((debtor) => ({ type: "Debtor", label: debtor, state: "observed" })),
      { type: "Evidence", label: `${report.assets.length} receivables`, state: "mapped" },
      { type: "Cash flow", label: `${report.metrics.paymentCount || 0} payment events`, state: "reconciled" },
    ];
  }, [report]);

  const runInvestigation = async () => {
    if (!question.trim()) return;
    setRunning(true);
    setAnswer("");
    for (let index = 0; index < 4; index += 1) {
      setStage(index);
      await new Promise((resolve) => window.setTimeout(resolve, 320));
    }
    const grounded = groundedAnswer(question, report);
    setFindings(grounded.findings);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: report }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { answer?: string; mode?: "model-grounded" };
      if (!data.answer) throw new Error();
      setAnswer(data.answer);
      setMode("model-grounded");
    } catch {
      setAnswer(grounded.summary);
      setMode("grounded-fallback");
    } finally {
      setRunning(false);
      setStage(4);
    }
  };

  return <section className="agent-view">
    <div className="agent-hero">
      <div><span className="agent-kicker"><i /> DUEVIA AI INVESTIGATOR</span><h2>Investigate an RWA<br />in one command.</h2><p>An evidence-grounded agent maps entities, reconciles asset and cash-flow signals, applies transparent policy, and prepares an executable X Layer decision.</p></div>
      <div className="agent-terminal">
        <label htmlFor="agent-question">INVESTIGATION OBJECTIVE</label>
        <textarea id="agent-question" value={question} onChange={(event) => setQuestion(event.target.value)} />
        <div className="prompt-chips">{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div>
        <button className="agent-run" type="button" onClick={runInvestigation} disabled={running}>{running ? "Agent is investigating…" : "Run Duevia Agent"}<span>→</span></button>
      </div>
    </div>

    <div className="agent-source-strip">
      <div><span>ERP / ASSET LEDGER</span><b>Sandbox connector</b><i className="sandbox" /></div>
      <div><span>BANK / CASH FLOW</span><b>Sandbox connector</b><i className="sandbox" /></div>
      <div><span>SERVICER</span><b>Sandbox connector</b><i className="sandbox" /></div>
      <div><span>X LAYER</span><b>Live wallet + registry</b><i /></div>
      <small>Workspace: {sourceName}</small>
    </div>

    <div className="agent-grid">
      <section className="agent-process">
        <div className="panel-title"><div><span>AGENT TRACE</span><h3>Autonomous investigation</h3></div><em>{running ? "RUNNING" : stage === 4 ? "COMPLETE" : "READY"}</em></div>
        <div className="agent-steps">
          {[
            ["01", "Discover", "Inspect source availability, freshness, and provenance."],
            ["02", "Resolve", "Build the issuer–debtor–invoice–payment relationship graph."],
            ["03", "Investigate", "Rank anomalies and test alternative explanations."],
            ["04", "Decide", "Apply policy and produce an executable pool state."],
          ].map(([number, name, copy], index) => <div className={stage >= index ? "active" : ""} key={number}><b>{number}</b><span><strong>{name}</strong><small>{copy}</small></span><i>{stage > index || stage === 4 ? "✓" : stage === index ? "…" : ""}</i></div>)}
        </div>
      </section>

      <section className="agent-result">
        <div className="panel-title"><div><span>GROUNDED DECISION</span><h3>Agent conclusion</h3></div><em className={mode}>{mode === "model-grounded" ? "AI MODEL LIVE" : "RULE-GROUNDED SANDBOX"}</em></div>
        <div className={`agent-decision ${report.state}`}><span>RECOMMENDED ACTION</span><strong>{report.state === "verified" ? "ALLOW" : report.state === "review" ? "HOLD" : "SUSPEND"}</strong><small>{report.metrics.highAlerts} high · {report.metrics.mediumAlerts} medium controls open</small></div>
        <div className="agent-answer">{answer || "Run the agent to generate an evidence-grounded investigation. Every conclusion remains linked to a policy control and source record."}</div>
        {answer && <div className="agent-findings">{findings.map((finding) => <article key={finding.code}><span>{finding.severity}</span><div><b>{finding.title}</b><small>{finding.action}</small></div><code>{finding.code}</code></article>)}</div>}
      </section>
    </div>

    <div className="agent-grid lower-grid">
      <section className="knowledge-panel"><div className="panel-title"><div><span>ASSET KNOWLEDGE GRAPH</span><h3>One asset state from many signals</h3></div><b>{graph.length} nodes</b></div><div className="knowledge-map">{graph.map((node, index) => <div className={`knowledge-node node-${index}`} key={`${node.type}-${node.label}`}><span>{node.type}</span><b>{node.label}</b><small>{node.state}</small></div>)}</div></section>
      <aside className="agent-action-panel"><span className="proof-label">HUMAN CONTROL</span><h3>AI proposes.<br />Policy executes.</h3><p>The model cannot silently approve an asset. Duevia keeps deterministic eligibility rules, evidence references, and human review boundaries visible.</p><button className="anchor-button" type="button" onClick={onOpenPortfolio}>Inspect controls & attest <span>→</span></button><small>Model-generated explanations never replace source evidence or legal review.</small></aside>
    </div>
  </section>;
}
