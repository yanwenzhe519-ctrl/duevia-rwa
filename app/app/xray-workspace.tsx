"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { analyzeCase, canonicalizeReport, type RiskReport } from "@/lib/risk-engine.mjs";
import { demoCase } from "@/lib/demo-case.mjs";

type EthereumProvider = { request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown> };
type EvidenceCase = Record<string, unknown> & { asset: Record<string, unknown>; documents: unknown[] };
declare global { interface Window { ethereum?: EthereumProvider } }

const tabs = ["Overview", "Evidence inbox", "Asset passport", "Monitoring", "Audit trail"] as const;
const moduleIcons: Record<string, string> = { documents: "D", entity: "E", asset: "A", risk: "R", monitoring: "M" };
function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
async function fingerprint(report: RiskReport) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalizeReport(report)));
  return `0x${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export default function XRayWorkspace() {
  const [caseData, setCaseData] = useState<EvidenceCase>(demoCase);
  const [report, setReport] = useState<RiskReport>(() => analyzeCase(demoCase));
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [activeModule, setActiveModule] = useState("risk");
  const [running, setRunning] = useState(false);
  const [uploadedName, setUploadedName] = useState("Built-in receivables case");
  const [proofHash, setProofHash] = useState("");
  const [wallet, setWallet] = useState("");
  const [notice, setNotice] = useState("Evidence workspace ready");
  const fileInput = useRef<HTMLInputElement>(null);
  const registryAddress = process.env.NEXT_PUBLIC_XRAY_REGISTRY_ADDRESS ?? "";
  const selected = useMemo(() => report.modules.find((m) => m.id === activeModule) ?? report.modules[0], [activeModule, report]);

  const runVerification = async () => {
    setRunning(true); setProofHash(""); setNotice("Running five verification modules and reconciling evidence…");
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const next = analyzeCase(caseData); setReport(next); setProofHash(await fingerprint(next)); setActiveModule("risk"); setTab("Overview"); setRunning(false); setNotice("Verification complete · report fingerprint generated");
  };
  const loadEvidencePackage = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !("asset" in parsed) || !("documents" in parsed) || !Array.isArray(parsed.documents)) throw new Error();
      const next = parsed as EvidenceCase; setCaseData(next); setUploadedName(file.name); setReport(analyzeCase(next)); setProofHash(""); setNotice("Evidence package loaded · run verification to issue a report");
    } catch { setNotice("Invalid package. Upload a structured JSON evidence package to continue."); }
  };
  const connectWallet = async () => {
    if (!window.ethereum) { setNotice("No injected wallet detected. Open this DApp with OKX Wallet or another EVM wallet."); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7A0" }] }); } catch { await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7A0", chainName: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: ["https://xlayertestrpc.okx.com/terigon"], blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer-test"] }] }); }
      setWallet(accounts[0] ?? ""); setNotice("Wallet connected to X Layer Testnet");
    } catch { setNotice("Wallet connection was cancelled or the network could not be added."); }
  };
  const downloadReport = () => { const blob = new Blob([JSON.stringify({ ...report, fingerprint: proofHash || null }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${report.reportId}.json`; a.click(); URL.revokeObjectURL(url); };
  const evidenceRows = [
    ["Issuer identity", "KYB / registration extract", "Verified", "entity"],
    ["Underlying obligation", "Invoice + purchase order", "Verified", "documents"],
    ["Delivery evidence", "Proof of delivery", "Verified", "asset"],
    ["Payment instruction", "Bank account letter", "Conflict", "entity"],
    ["Cash-flow event", "Settlement status", "Review", "monitoring"],
  ];

  return <main className="dapp-shell">
    <aside className="app-sidebar">
      <Link className="xray-brand app-brand" href="/"><span className="xray-mark">X</span><span>X-RAY RWA</span></Link>
      <div className="case-label">WORKSPACE</div>
      <button className="case-card active" type="button"><span>TR</span><div><b>Trade receivable</b><small>{report.caseId}</small></div><i /></button>
      <nav className="module-nav" aria-label="Verification modules"><span>MODULES</span>{report.modules.map((module) => <button key={module.id} type="button" className={activeModule === module.id ? "active" : ""} onClick={() => { setActiveModule(module.id); setTab("Overview"); }}><i>{moduleIcons[module.id]}</i><span>{module.shortName}</span><em className={module.status}>{module.score}</em></button>)}</nav>
      <div className="sidebar-bottom"><div className="network-card"><i /><div><b>X Layer Testnet</b><small>Chain ID 1952</small></div></div><Link href="/">← Back to website</Link></div>
    </aside>
    <section className="app-main">
      <header className="app-topbar"><div><span>CASE / {report.caseId}</span><h1>{report.assetName}</h1></div><div className="app-actions"><button className="ghost-action" type="button" onClick={downloadReport}>Export report</button><button className="wallet-action" type="button" onClick={connectWallet}>{wallet ? shortAddress(wallet) : "Connect wallet"}</button></div></header>
      <nav className="workspace-tabs" aria-label="Case views">{tabs.map((item) => <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <div className="app-content">
        {tab === "Overview" && <><section className="case-overview"><div className="overview-copy"><span className={`status-pill ${report.status}`}>{report.decision}</span><h2>Evidence before exposure.</h2><p>AI-assisted extraction, deterministic controls, and traceable evidence for every material exception.</p></div><div className="score-dial"><strong>{report.score}</strong><span>/ 100</span><small>Evidence score</small></div><div className="overview-metrics"><div><span>High risk</span><b className="red">{report.counts.high}</b></div><div><span>Needs attention</span><b className="amber">{report.counts.medium}</b></div><div><span>Checks passed</span><b className="green">{report.counts.passed}</b></div></div></section><section className="verification-toolbar"><div className="evidence-source"><span>Evidence package</span><b>{uploadedName}</b><small>Local processing · no raw files leave this browser</small></div><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && loadEvidencePackage(e.target.files[0])} /><button className="upload-package" type="button" onClick={() => fileInput.current?.click()}>Add evidence</button><button className="run-check" type="button" onClick={runVerification} disabled={running}>{running ? "Running checks…" : "Run all 5 modules"}<span>→</span></button></section><div className="status-line"><i className={running ? "scanning" : ""} /><span>{notice}</span></div><section className="module-workspace"><div className="module-panel"><div className="module-panel-head"><div><span>MODULE {String(report.modules.findIndex((m) => m.id === selected.id) + 1).padStart(2, "0")}</span><h3>{selected.name}</h3><p>{selected.summary}</p></div><div className={`module-score ${selected.status}`}><strong>{selected.score}</strong><span>/100</span></div></div><div className="finding-stack">{selected.findings.length ? selected.findings.map((item) => <article key={`${item.code}-${item.title}`} className={`finding-card ${item.severity}`}><div className="finding-top"><span>{item.severity}</span><code>{item.code}</code></div><h4>{item.title}</h4><p>{item.explanation}</p>{item.evidence?.length > 0 && <div className="evidence-links">{item.evidence.map((ev) => <button type="button" key={ev}>↗ {ev}</button>)}</div>}</article>) : <div className="no-findings">No material exceptions detected in this module.</div>}</div></div><aside className="proof-panel"><span className="proof-label">VERIFIABLE PROOF</span><h3>Private data stays offchain.</h3><p>Only the report fingerprint, status, version, and issuer wallet are intended for the X Layer registry.</p><div className="hash-box"><span>REPORT FINGERPRINT</span><code>{proofHash || "Run verification to generate"}</code></div><dl><div><dt>Report</dt><dd>{report.reportId}</dd></div><div><dt>Methodology</dt><dd>{report.methodology}</dd></div><div><dt>Network</dt><dd>X Layer Testnet</dd></div></dl><button className="anchor-button" type="button" disabled={!proofHash || !wallet || !registryAddress}>{!registryAddress ? "Registry deployment pending" : !wallet ? "Connect wallet to anchor" : "Anchor proof on X Layer"}</button><small className="proof-note">Signing happens in the connected wallet. Raw documents are never written onchain.</small></aside></section></>}
        {tab === "Evidence inbox" && <section className="detail-view"><div className="detail-heading"><div><span>CASE EVIDENCE</span><h2>Evidence inbox</h2><p>Every claim is mapped to a source, a status, and a next action.</p></div><button className="upload-package" type="button" onClick={() => fileInput.current?.click()}>Add evidence</button></div><div className="evidence-table"><div className="table-head"><span>Coverage</span><span>Evidence item</span><span>Status</span><span>Module</span></div>{evidenceRows.map(([coverage, item, status, module]) => <div className="table-row" key={coverage}><b>{coverage}</b><span>{item}</span><em className={status.toLowerCase()}>{status}</em><button type="button" onClick={() => { setActiveModule(module); setTab("Overview"); }}>{moduleIcons[module]}</button></div>)}</div><div className="empty-drop">Drop PDF, CSV, or JSON evidence here <span>PDF extraction is next on the roadmap</span></div></section>}
        {tab === "Asset passport" && <section className="detail-view"><div className="detail-heading"><div><span>ASSET PROFILE</span><h2>Asset passport</h2><p>A review-ready profile for allocators, issuers, and counterparties.</p></div><span className={`status-pill ${report.status}`}>{report.decision}</span></div><div className="passport-grid"><div><span>Asset type</span><strong>Trade receivable</strong></div><div><span>Face value</span><strong>48,600 USDT</strong></div><div><span>Issuer</span><strong>Hangzhou Nova Components Ltd.</strong></div><div><span>Jurisdiction</span><strong>China · PRC</strong></div><div><span>Evidence coverage</span><strong>{report.counts.passed} / {report.modules.length * 2 + report.counts.passed} controls</strong></div><div><span>Last verified</span><strong>14 Aug 2026 · Local session</strong></div></div><div className="passport-callout"><b>Decision rationale</b><p>Two exceptions require human review before settlement: beneficiary mismatch and payment-before-delivery sequencing.</p></div></section>}
        {tab === "Monitoring" && <section className="detail-view"><div className="detail-heading"><div><span>CONTINUOUS CONTROLS</span><h2>Monitoring</h2><p>Track what changed after the initial verification.</p></div><span className="live-badge"><i /> Live checks</span></div><div className="monitor-grid"><div className="monitor-card"><span>Next evidence refresh</span><strong>In 23 hours</strong><small>Counterparty and payment status</small></div><div className="monitor-card amber-card"><span>Open alerts</span><strong>{report.counts.high + report.counts.medium}</strong><small>Require analyst attention</small></div><div className="monitor-card"><span>Data freshness</span><strong>98%</strong><small>Across mapped evidence fields</small></div></div><div className="timeline-list"><div><b>Now</b><span>Verification report generated</span><em>{report.score}/100 score</em></div><div><b>Pending</b><span>Payment beneficiary confirmation</span><em>Owner: issuer</em></div><div><b>Scheduled</b><span>Refresh counterparty screening</span><em>Tomorrow</em></div></div></section>}
        {tab === "Audit trail" && <section className="detail-view"><div className="detail-heading"><div><span>CHAIN OF CUSTODY</span><h2>Audit trail</h2><p>An append-only record of decisions and evidence state changes.</p></div></div><div className="timeline-list audit-list"><div><b>14 Aug 2026 · 10:42</b><span>Report fingerprint generated</span><em>{proofHash ? `${proofHash.slice(0, 18)}…` : "Awaiting verification"}</em></div><div><b>14 Aug 2026 · 10:41</b><span>Five verification modules completed</span><em>Local rule engine</em></div><div><b>14 Aug 2026 · 10:40</b><span>Evidence package loaded</span><em>{uploadedName}</em></div><div><b>Next step</b><span>Anchor proof to X Layer Testnet</span><em>{registryAddress ? "Ready when wallet signs" : "Registry not configured"}</em></div></div></section>}
      </div>
    </section>
  </main>;
}
