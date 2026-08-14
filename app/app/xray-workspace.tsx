"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { analyzeCase, canonicalizeReport, type RiskReport } from "@/lib/risk-engine.mjs";
import { demoCase } from "@/lib/demo-case.mjs";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
};

type EvidenceCase = Record<string, unknown> & {
  asset: Record<string, unknown>;
  documents: unknown[];
};

declare global {
  interface Window { ethereum?: EthereumProvider }
}

const moduleIcons: Record<string, string> = {
  documents: "D",
  entity: "E",
  asset: "A",
  risk: "R",
  monitoring: "M",
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

async function fingerprint(report: RiskReport) {
  const bytes = new TextEncoder().encode(canonicalizeReport(report));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export default function XRayWorkspace() {
  const [caseData, setCaseData] = useState<EvidenceCase>(demoCase);
  const [report, setReport] = useState<RiskReport>(() => analyzeCase(demoCase));
  const [activeModule, setActiveModule] = useState("risk");
  const [running, setRunning] = useState(false);
  const [uploadedName, setUploadedName] = useState("Built-in receivables case");
  const [proofHash, setProofHash] = useState("");
  const [wallet, setWallet] = useState("");
  const [notice, setNotice] = useState("Evidence engine ready");
  const fileInput = useRef<HTMLInputElement>(null);
  const registryAddress = process.env.NEXT_PUBLIC_XRAY_REGISTRY_ADDRESS ?? "";

  const selected = useMemo(
    () => report.modules.find((module) => module.id === activeModule) ?? report.modules[0],
    [activeModule, report],
  );

  const runVerification = async () => {
    setRunning(true);
    setProofHash("");
    setNotice("Running document, entity, asset, risk, and freshness checks…");
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const nextReport = analyzeCase(caseData);
    setReport(nextReport);
    setProofHash(await fingerprint(nextReport));
    setActiveModule("risk");
    setRunning(false);
    setNotice("Verification complete · report fingerprint generated");
  };

  const loadEvidencePackage = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !("asset" in parsed) || !("documents" in parsed) || !Array.isArray(parsed.documents)) throw new Error("Invalid evidence package");
      const nextCase = parsed as EvidenceCase;
      setCaseData(nextCase);
      setUploadedName(file.name);
      setReport(analyzeCase(nextCase));
      setProofHash("");
      setNotice("Evidence package loaded · run verification to issue a report");
    } catch {
      setNotice("This MVP accepts a structured JSON evidence package. Use the sample case to continue.");
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setNotice("No injected wallet detected. Open this DApp in a browser with OKX Wallet or another EVM wallet.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7A0" }] });
      } catch {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x7A0",
            chainName: "X Layer Testnet",
            nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
            rpcUrls: ["https://xlayertestrpc.okx.com/terigon"],
            blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer-test"],
          }],
        });
      }
      setWallet(accounts[0] ?? "");
      setNotice("Wallet connected to X Layer Testnet");
    } catch {
      setNotice("Wallet connection was cancelled or the network could not be added.");
    }
  };

  const downloadReport = () => {
    const payload = { ...report, fingerprint: proofHash || null };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.reportId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="dapp-shell">
      <aside className="app-sidebar">
        <Link className="xray-brand app-brand" href="/"><span className="xray-mark">X</span><span>X-RAY RWA</span></Link>
        <div className="case-label">ACTIVE CASE</div>
        <button className="case-card active" type="button">
          <span>TR</span><div><b>Trade receivable</b><small>{report.caseId}</small></div><i />
        </button>
        <nav className="module-nav" aria-label="Verification modules">
          <span>MODULES</span>
          {report.modules.map((module) => (
            <button key={module.id} type="button" className={activeModule === module.id ? "active" : ""} onClick={() => setActiveModule(module.id)}>
              <i>{moduleIcons[module.id]}</i><span>{module.shortName}</span><em className={module.status}>{module.score}</em>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="network-card"><i /><div><b>X Layer Testnet</b><small>Chain ID 1952</small></div></div>
          <Link href="/">← Back to website</Link>
        </div>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div><span>CASE / {report.caseId}</span><h1>{report.assetName}</h1></div>
          <div className="app-actions">
            <button className="ghost-action" type="button" onClick={downloadReport}>Download report</button>
            <button className="wallet-action" type="button" onClick={connectWallet}>{wallet ? shortAddress(wallet) : "Connect wallet"}</button>
          </div>
        </header>

        <div className="app-content">
          <section className="case-overview">
            <div className="overview-copy">
              <span className={`status-pill ${report.status}`}>{report.decision}</span>
              <h2>Evidence before exposure.</h2>
              <p>Review AI-extracted facts, deterministic checks, and the evidence behind every material exception.</p>
            </div>
            <div className="score-dial"><strong>{report.score}</strong><span>/ 100</span><small>Evidence score</small></div>
            <div className="overview-metrics">
              <div><span>High risk</span><b className="red">{report.counts.high}</b></div>
              <div><span>Needs attention</span><b className="amber">{report.counts.medium}</b></div>
              <div><span>Checks passed</span><b className="green">{report.counts.passed}</b></div>
            </div>
          </section>

          <section className="verification-toolbar">
            <div className="evidence-source">
              <span>Evidence package</span><b>{uploadedName}</b><small>JSON is processed locally in this MVP</small>
            </div>
            <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && loadEvidencePackage(event.target.files[0])} />
            <button className="upload-package" type="button" onClick={() => fileInput.current?.click()}>Upload JSON</button>
            <button className="run-check" type="button" onClick={runVerification} disabled={running}>{running ? "Running checks…" : "Run all 5 modules"}<span>→</span></button>
          </section>

          <div className="status-line"><i className={running ? "scanning" : ""} /><span>{notice}</span></div>

          <section className="module-workspace">
            <div className="module-panel">
              <div className="module-panel-head">
                <div><span>MODULE {String(report.modules.findIndex((module) => module.id === selected.id) + 1).padStart(2, "0")}</span><h3>{selected.name}</h3><p>{selected.summary}</p></div>
                <div className={`module-score ${selected.status}`}><strong>{selected.score}</strong><span>/100</span></div>
              </div>
              <div className="finding-stack">
                {selected.findings.length ? selected.findings.map((item) => (
                  <article key={`${item.code}-${item.title}`} className={`finding-card ${item.severity}`}>
                    <div className="finding-top"><span>{item.severity}</span><code>{item.code}</code></div>
                    <h4>{item.title}</h4>
                    <p>{item.explanation}</p>
                    {item.evidence?.length > 0 && <div className="evidence-links">{item.evidence.map((evidence) => <button type="button" key={evidence}>↗ {evidence}</button>)}</div>}
                  </article>
                )) : <div className="no-findings">No material exceptions detected in this module.</div>}
              </div>
            </div>

            <aside className="proof-panel">
              <span className="proof-label">VERIFIABLE PROOF</span>
              <h3>Private data stays offchain.</h3>
              <p>Only the report fingerprint, status, version, and issuer wallet are intended for the X Layer registry.</p>
              <div className="hash-box"><span>REPORT FINGERPRINT</span><code>{proofHash || "Run verification to generate"}</code></div>
              <dl>
                <div><dt>Report</dt><dd>{report.reportId}</dd></div>
                <div><dt>Methodology</dt><dd>{report.methodology}</dd></div>
                <div><dt>Status</dt><dd>{report.status}</dd></div>
                <div><dt>Network</dt><dd>X Layer Testnet</dd></div>
              </dl>
              <button className="anchor-button" type="button" disabled={!proofHash || !wallet || !registryAddress} title={!registryAddress ? "Deploy the registry contract and configure its address to enable anchoring" : undefined}>
                {!registryAddress ? "Registry deployment pending" : !wallet ? "Connect wallet to anchor" : "Anchor proof on X Layer"}
              </button>
              <small className="proof-note">The interface never asks for a private key. Signing happens in the connected wallet.</small>
            </aside>
          </section>

          <p className="app-disclaimer">{report.disclaimer}</p>
        </div>
      </section>
    </main>
  );
}
