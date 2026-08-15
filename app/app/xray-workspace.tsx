"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPublicClient, createWalletClient, custom, encodeDeployData, encodeFunctionData, getCreate2Address, http, isAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { analyzeCase, canonicalizeReport } from "@/lib/risk-engine.mjs";
import { demoCase } from "@/lib/demo-case.mjs";
import { dueviaRegistryAbi, dueviaRegistryBytecode } from "@/lib/duevia-registry-artifact";
import { analyzePortfolio, parseAssetTapeCsv, parsePaymentsCsv } from "@/lib/portfolio-engine.mjs";
import { portfolioDemo } from "@/lib/portfolio-demo.mjs";
import AiInvestigator from "./ai-investigator";
import ContinuityAgent from "./continuity-agent";

type EthereumProvider = { request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown> };
type EvidenceCase = Record<string, unknown> & { asset: Record<string, unknown>; documents: unknown[] };
type Report = ReturnType<typeof analyzeCase>;
declare global { interface Window { ethereum?: EthereumProvider } }

const tabs = ["Continuity Agent", "AI Investigator", "Portfolio controls", "Asset verification", "Asset passport", "Monitoring", "Audit trail"] as const;
const moduleIcons: Record<string, string> = { documents: "E", entity: "I", asset: "A", risk: "P", monitoring: "M" };
const statusLabel: Record<string, string> = { verified: "VERIFIED", review: "MANUAL REVIEW", suspended: "SUSPENDED" };
const statusCopy: Record<string, string> = {
  verified: "All required policy controls are currently satisfied.",
  review: "A human reviewer must resolve material exceptions before automated eligibility.",
  suspended: "The asset does not satisfy the assurance policy. Automated processing should remain blocked.",
};
const xLayerTestnet = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" } },
} as const;
const zeroHash = `0x${"0".repeat(64)}` as Hex;
const create2Factory = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address;
const registrySalt = `0x8b9d4d76a3f2e1c0b7a6958473625140fedcba98765432100123456789abcdef0` as Hex;

function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
async function fingerprint(report: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalizeReport(report as Report)));
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export default function DueviaWorkspace() {
  const [caseData, setCaseData] = useState<EvidenceCase>(demoCase);
  const [report, setReport] = useState<Report>(() => analyzeCase(demoCase));
  const [portfolio, setPortfolio] = useState(() => portfolioDemo);
  const [portfolioReport, setPortfolioReport] = useState(() => analyzePortfolio(portfolioDemo));
  const [portfolioSource, setPortfolioSource] = useState("Built-in stressed asset tape");
  const [portfolioProofHash, setPortfolioProofHash] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Continuity Agent");
  const [activeModule, setActiveModule] = useState("risk");
  const [running, setRunning] = useState(false);
  const [uploadedName, setUploadedName] = useState("Built-in trade receivable case");
  const [proofHash, setProofHash] = useState("");
  const [wallet, setWallet] = useState("");
  const [anchorTx, setAnchorTx] = useState("");
  const [deployedRegistry, setDeployedRegistry] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [notice, setNotice] = useState("Workspace ready · private evidence stays in this browser");
  const fileInput = useRef<HTMLInputElement>(null);
  const portfolioFileInput = useRef<HTMLInputElement>(null);
  const paymentFileInput = useRef<HTMLInputElement>(null);
  const registryAddress = deployedRegistry || process.env.NEXT_PUBLIC_DUEVIA_REGISTRY_ADDRESS || "";
  const selected = useMemo(() => report.modules.find((module) => module.id === activeModule) ?? report.modules[0], [activeModule, report]);

  useEffect(() => {
    const saved = window.localStorage.getItem("duevia-testnet-registry");
    // Restore the last user-deployed registry after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved && isAddress(saved)) setDeployedRegistry(saved);
  }, []);

  const runVerification = async () => {
    setRunning(true);
    setProofHash("");
    setNotice("Reconciling evidence, evaluating policy controls, and preparing the attestation…");
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    const next = analyzeCase(caseData);
    setReport(next);
    setProofHash(await fingerprint(next));
    setActiveModule("risk");
    setTab("Asset verification");
    setRunning(false);
    setNotice("Assurance decision ready · fingerprint generated for X Layer");
  };

  const loadEvidencePackage = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !("asset" in parsed) || !("documents" in parsed) || !Array.isArray(parsed.documents)) throw new Error();
      const next = parsed as EvidenceCase;
      setCaseData(next);
      setUploadedName(file.name);
      setReport(analyzeCase(next));
      setProofHash("");
      setNotice("Evidence package loaded · run the assurance policy to issue a new status");
    } catch {
      setNotice("This demo accepts a structured JSON evidence package. PDF and CSV connectors are planned inputs, not yet live in the browser demo.");
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) { setNotice("No injected wallet detected. Open the DApp with OKX Wallet or another EVM wallet."); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] });
      } catch {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7a0", chainName: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: ["https://testrpc.xlayer.tech"], blockExplorerUrls: ["https://www.oklink.com/x-layer-testnet"] }] });
      }
      setWallet(accounts[0] ?? "");
      setNotice("Wallet connected to X Layer Testnet · chain ID 1952");
    } catch { setNotice("Wallet connection was cancelled or the X Layer network could not be added."); }
  };

  const deployRegistry = async () => {
    if (!window.ethereum || !wallet) {
      setNotice("Connect an EVM wallet first. Deployment needs a small amount of X Layer Testnet OKB.");
      return;
    }
    try {
      setDeploying(true);
      setNotice("Requesting wallet approval to deploy the Duevia testnet registry...");
      const walletClient = createWalletClient({ chain: xLayerTestnet, transport: custom(window.ethereum) });
      // Route deployment through the canonical CREATE2 factory. This is a
      // normal contract call and is compatible with wallets that reject raw
      // contract-creation requests or only sponsor contract calls.
      const initCode = encodeDeployData({ abi: dueviaRegistryAbi, bytecode: dueviaRegistryBytecode, args: [wallet as Address] });
      const registryAddress = getCreate2Address({
        from: create2Factory,
        salt: registrySalt,
        bytecodeHash: keccak256(initCode),
      });
      const hash = await walletClient.sendTransaction({ account: wallet as Address, to: create2Factory, data: `${registrySalt}${initCode.slice(2)}` as Hex });
      setNotice("Registry transaction submitted. Waiting for X Layer Testnet confirmation...");
      const publicClient = createPublicClient({ chain: xLayerTestnet, transport: http("https://testrpc.xlayer.tech") });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const deployedCode = await publicClient.getBytecode({ address: registryAddress });
      if (!deployedCode || deployedCode === "0x") throw new Error("Registry deployment receipt confirmed but no code exists at the predicted address");
      const deployedOwner = await publicClient.readContract({ address: registryAddress, abi: dueviaRegistryAbi, functionName: "owner" });
      if (String(deployedOwner).toLowerCase() !== wallet.toLowerCase()) throw new Error("Registry owner does not match the connected wallet");
      setDeployedRegistry(registryAddress);
      window.localStorage.setItem("duevia-testnet-registry", registryAddress);
      setAnchorTx(hash);
      setNotice(`Testnet registry deployed: ${shortAddress(receipt.contractAddress)}. You are its first authorized attestor.`);
    } catch {
      setNotice("Registry deployment was not completed. Check the wallet network, confirm the transaction, and make sure the wallet has testnet OKB.");
    } finally {
      setDeploying(false);
    }
  };

  const loadBuiltInScenario = (eligible: boolean) => {
    const next = structuredClone(demoCase) as EvidenceCase;
    next.caseId = eligible ? "INV-2026-0814-PASS" : "INV-2026-0814-REVIEW";
    next.asset.name = eligible ? "Nova Components Receivable — eligible sample" : "Nova Components Receivable — review sample";
    if (eligible) {
      const issuer = next.issuer as Record<string, unknown>;
      issuer.bankAccountHolder = issuer.legalName;
      const documents = next.documents as Array<Record<string, unknown>>;
      const invoice = documents.find((item) => item.type === "invoice");
      if (invoice) invoice.dueDate = "2026-08-31";
      const payment = documents.find((item) => item.type === "payment_instruction");
      if (payment) payment.accountHolder = issuer.legalName;
    }
    setCaseData(next);
    setReport(analyzeCase(next));
    setUploadedName(eligible ? "Built-in eligible trade receivable" : "Built-in review trade receivable");
    setProofHash("");
    setAnchorTx("");
    setNotice(eligible
      ? "Eligible sample loaded. Run the policy to create a VERIFIED testnet attestation."
      : "Review sample loaded. It intentionally contains a beneficiary conflict for analyst review.");
  };

  const publishAttestation = async () => {
    if (!window.ethereum || !wallet || !registryAddress || !proofHash || !isAddress(registryAddress)) return;
    try {
      const assetId = keccak256(stringToHex(`duevia:asset:${report.caseId}`));
      const attestationId = keccak256(stringToHex(`duevia:attestation:${report.reportId}:${proofHash}`));
      const policyHash = keccak256(stringToHex(report.policyId));
      const validUntil = Math.floor(Math.max(Date.now() + 86_400_000, report.validUntil ? new Date(report.validUntil).getTime() : 0) / 1000);
      const status = report.status === "verified" ? 1 : report.status === "review" ? 2 : 4;
      const data = encodeFunctionData({
        abi: dueviaRegistryAbi,
        functionName: "publishAttestation",
        args: [assetId, attestationId, proofHash as Hex, policyHash, zeroHash, BigInt(validUntil), report.score, status],
      });
      setNotice("Requesting wallet signature to publish the asset attestation on X Layer…");
      const client = createWalletClient({ chain: xLayerTestnet, transport: custom(window.ethereum) });
      const hash = await client.sendTransaction({ account: wallet as Address, to: registryAddress as Address, data });
      setAnchorTx(hash);
      setNotice(`Attestation submitted to X Layer Testnet: ${shortAddress(hash)}`);
    } catch {
      setNotice("Attestation was not published. Confirm the deployed registry address, wallet network, and testnet OKB balance.");
    }
  };

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify({ ...report, fingerprint: proofHash || null }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.reportId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadPortfolioCsv = async (file: File) => {
    try {
      const imported = parseAssetTapeCsv(await file.text(), {
        poolId: "DUE-IMPORTED-01",
        poolName: file.name.replace(/\.csv$/i, ""),
        tokenSupply: portfolio.tokenSupply,
      });
      setPortfolio(imported);
      setPortfolioReport(analyzePortfolio(imported));
      setPortfolioSource(file.name);
      setPortfolioProofHash("");
      setNotice(`Asset tape loaded · ${imported.assets.length} receivables evaluated against five policy controls.`);
      setTab("Portfolio controls");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The asset tape could not be parsed.");
    }
  };

  const loadPaymentCsv = async (file: File) => {
    try {
      const payments = parsePaymentsCsv(await file.text());
      const next = { ...portfolio, payments };
      setPortfolio(next);
      setPortfolioReport(analyzePortfolio(next));
      setPortfolioSource(`${portfolioSource} + ${file.name}`);
      setPortfolioProofHash("");
      setNotice(`Payment ledger loaded · ${payments.length} cash-flow event(s) reconciled against invoice, payer, beneficiary, and balance.`);
      setTab("Portfolio controls");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The payment ledger could not be parsed.");
    }
  };

  const downloadCsvTemplate = () => {
    const header = "assetId,invoiceId,originator,debtor,faceValue,outstanding,dueDate,status,bankAccount,documentHash,source,lastUpdatedAt";
    const sample = "AR-100,INV-100,Example Originator,Example Debtor,50000,50000,2026-09-30,active,ACCT-100,sha256:replace-me,ERP,2026-08-14";
    const blob = new Blob([`${header}\n${sample}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "duevia-asset-tape-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPaymentTemplate = () => {
    const header = "paymentId,invoiceId,payer,beneficiaryAccount,amount,paidAt,source";
    const sample = "PAY-100,INV-100,Example Debtor,ACCT-100,10000,2026-08-14,Bank statement";
    const blob = new Blob([`${header}\n${sample}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "duevia-payment-ledger-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const preparePortfolioAttestation = async () => {
    const hash = await fingerprint(portfolioReport);
    setPortfolioProofHash(hash);
    setNotice("Portfolio assurance fingerprint generated from the full asset tape, payment reconciliation, policy results, and state.");
  };

  const publishPortfolioAttestation = async () => {
    if (!window.ethereum || !wallet || !registryAddress || !portfolioProofHash || !isAddress(registryAddress)) return;
    try {
      const poolId = keccak256(stringToHex(`duevia:pool:${portfolioReport.poolId}`));
      const attestationId = keccak256(stringToHex(`duevia:pool-attestation:${portfolioReport.poolId}:${portfolioProofHash}`));
      const policyHash = keccak256(stringToHex("RECEIVABLE_POOL_ASSURANCE_V1"));
      const score = Math.max(0, Math.min(100, 100 - portfolioReport.metrics.highAlerts * 25 - portfolioReport.metrics.mediumAlerts * 8));
      const status = portfolioReport.state === "verified" ? 1 : portfolioReport.state === "review" ? 2 : 4;
      const validUntil = BigInt(Math.floor((Date.now() + 7 * 86_400_000) / 1000));
      const data = encodeFunctionData({
        abi: dueviaRegistryAbi,
        functionName: "publishAttestation",
        args: [poolId, attestationId, portfolioProofHash as Hex, policyHash, zeroHash, validUntil, score, status],
      });
      setNotice("Requesting wallet signature for the portfolio-state attestation...");
      const client = createWalletClient({ chain: xLayerTestnet, transport: custom(window.ethereum) });
      const hash = await client.sendTransaction({ account: wallet as Address, to: registryAddress as Address, data });
      setAnchorTx(hash);
      setNotice(`Portfolio ${portfolioReport.state.toUpperCase()} state submitted to X Layer Testnet: ${shortAddress(hash)}`);
    } catch {
      setNotice("Portfolio attestation was not published. Confirm the registry, wallet network, and testnet OKB balance.");
    }
  };

  const publishContinuityState = async () => {
    if (!window.ethereum || !wallet || !registryAddress || !isAddress(registryAddress)) throw new Error("Wallet and registry required");
    const assetId = keccak256(stringToHex("duevia:pool:continuity-demo"));
    const recoveryRoot = keccak256(stringToHex("duevia:recovery:servicer-offline:v1:18-assets:3-payments"));
    const attestationId = keccak256(stringToHex(`duevia:continuity:${Date.now()}`));
    const policyHash = keccak256(stringToHex("DUEVIA_CONTINUITY_FAILOVER_V1"));
    const validUntil = BigInt(Math.floor((Date.now() + 7 * 86_400_000) / 1000));
    const data = encodeFunctionData({
      abi: dueviaRegistryAbi,
      functionName: "publishAttestation",
      args: [assetId, attestationId, recoveryRoot, policyHash, zeroHash, validUntil, 88, 1],
    });
    const client = createWalletClient({ chain: xLayerTestnet, transport: custom(window.ethereum) });
    const hash = await client.sendTransaction({ account: wallet as Address, to: registryAddress as Address, data });
    setAnchorTx(hash);
    setNotice(`Continuity recovery attestation submitted to X Layer Testnet: ${shortAddress(hash)}`);
  };

  const validUntil = report.validUntil ? new Date(report.validUntil).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not set";

  return <main className="dapp-shell">
    <aside className="app-sidebar">
      <Link className="xray-brand app-brand" href="/"><span className="xray-mark">D</span><span>DUEVIA RWA</span></Link>
      <div className="case-label">ASSET WORKSPACE</div>
      <button className="case-card active" type="button"><span>TR</span><div><b>Trade receivable</b><small>{report.caseId}</small></div><i /></button>
      <nav className="module-nav" aria-label="Duevia assurance capabilities"><span>ASSURANCE CONTROLS</span>{report.modules.map((module) => <button key={module.id} type="button" className={activeModule === module.id ? "active" : ""} onClick={() => { setActiveModule(module.id); setTab("Asset verification"); }}><i>{moduleIcons[module.id]}</i><span>{module.shortName}</span><em className={module.status}>{module.score}</em></button>)}</nav>
      <div className="sidebar-bottom"><div className="network-card"><i /><div><b>X Layer Testnet</b><small>Chain ID 1952</small></div></div><Link href="/">← Website</Link></div>
    </aside>

    <section className="app-main">
      <header className="app-topbar"><div><span>ASSET / {report.caseId}</span><h1>{report.assetName}</h1></div><div className="app-actions"><button className="ghost-action" type="button" onClick={downloadReport}>Export attestation</button><button className="wallet-action" type="button" onClick={connectWallet}>{wallet ? shortAddress(wallet) : "Connect wallet"}</button></div></header>
      <nav className="workspace-tabs" aria-label="Asset views">{tabs.map((item) => <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <div className="app-content">
        {tab === "Continuity Agent" && <ContinuityAgent onPublishState={publishContinuityState} />}
        {tab === "AI Investigator" && <AiInvestigator report={portfolioReport} sourceName={portfolioSource} onOpenPortfolio={() => setTab("Portfolio controls")} />}
        {tab === "Portfolio controls" && <section className="portfolio-view">
          <div className="detail-heading portfolio-heading"><div><span>POLICY & EXECUTION</span><h2>{portfolioReport.poolName}</h2><p>The AI investigation layer resolves signals here into transparent eligibility controls and an executable pool state.</p></div><button className="ghost-action" type="button" onClick={() => setTab("AI Investigator")}>← Back to AI Investigator</button></div>
          <div className="portfolio-source"><span>DATA SOURCE</span><b>{portfolioSource}</b><em>As of {new Date(portfolioReport.asOf).toLocaleDateString("en-GB")}</em></div>
          <details className="manual-import"><summary>Developer data tools <span>Manual CSV import and templates</span></summary><div className="portfolio-actions"><input ref={portfolioFileInput} hidden type="file" accept="text/csv,.csv" onChange={(event) => event.target.files?.[0] && loadPortfolioCsv(event.target.files[0])} /><input ref={paymentFileInput} hidden type="file" accept="text/csv,.csv" onChange={(event) => event.target.files?.[0] && loadPaymentCsv(event.target.files[0])} /><button className="upload-package" type="button" onClick={downloadCsvTemplate}>Asset template</button><button className="upload-package" type="button" onClick={downloadPaymentTemplate}>Payment template</button><button className="run-check" type="button" onClick={() => portfolioFileInput.current?.click()}>Import asset tape <span>→</span></button><button className="run-check secondary-run" type="button" onClick={() => paymentFileInput.current?.click()}>Import payments <span>→</span></button></div></details>
          <div className="pool-metrics">
            <article><span>Pool state</span><strong className={portfolioReport.state}>{portfolioReport.state.toUpperCase()}</strong><small>{portfolioReport.metrics.highAlerts} high · {portfolioReport.metrics.mediumAlerts} medium alerts</small></article>
            <article><span>Total outstanding</span><strong>{portfolioReport.metrics.totalOutstanding.toLocaleString()} USDT</strong><small>{portfolioReport.metrics.assetCount} receivables</small></article>
            <article><span>Eligible collateral</span><strong>{portfolioReport.metrics.eligibleOutstanding.toLocaleString()} USDT</strong><small>{(portfolioReport.metrics.eligibleCoverage * 100).toFixed(1)}% of represented supply</small></article>
            <article><span>Reconciled cash</span><strong>{portfolioReport.metrics.reconciledCash.toLocaleString()} USDT</strong><small>{portfolioReport.metrics.paymentCount} verified payment event(s)</small></article>
            <article><span>Largest debtor</span><strong>{portfolioReport.concentration[0]?.debtor || "—"}</strong><small>{((portfolioReport.concentration[0]?.share || 0) * 100).toFixed(1)}% concentration</small></article>
          </div>
          <div className="portfolio-layout">
            <div className="portfolio-main">
              <div className="panel-title"><div><span>ASSET TAPE</span><h3>Receivable-level eligibility</h3></div><b>{portfolioReport.assets.filter((asset: Record<string, unknown>) => asset.eligible).length}/{portfolioReport.assets.length} eligible</b></div>
              <div className="asset-tape">
                <div className="asset-head"><span>Asset</span><span>Debtor</span><span>Outstanding</span><span>Due</span><span>Source</span><span>Decision</span></div>
                {portfolioReport.assets.map((asset: Record<string, unknown>) => <div className="asset-row" key={String(asset.assetId)}><b>{String(asset.assetId)}<small>{String(asset.invoiceId)}</small></b><span>{String(asset.debtor)}</span><span>{Number(asset.outstanding).toLocaleString()}</span><span>{String(asset.dueDate)}{Number(asset.daysPastDue) > 0 && <small className="late">{String(asset.daysPastDue)}d late</small>}</span><span>{String(asset.source || "Upload")}<small>{String(asset.lastUpdatedAt)}</small></span><em className={asset.eligible ? "eligible" : "blocked"}>{asset.eligible ? "ELIGIBLE" : "BLOCKED"}</em></div>)}
              </div>
              <div className="alert-section"><div className="panel-title"><div><span>ACTION QUEUE</span><h3>Exceptions that change pool state</h3></div></div>{portfolioReport.alerts.map((alert: Record<string, unknown>, index: number) => <article className={`portfolio-alert ${String(alert.severity)}`} key={`${String(alert.code)}-${index}`}><div><span>{String(alert.severity).toUpperCase()}</span><code>{String(alert.code)}</code></div><h4>{String(alert.title)}</h4><p>{String(alert.action)}</p><small>{Array.isArray(alert.assets) ? alert.assets.join(" · ") : ""}</small></article>)}</div>
            </div>
            <aside className="policy-panel"><span className="proof-label">POLICY ENGINE</span><h3>Rules before capital moves.</h3><p>Transparent deterministic controls produce the onchain state. AI assists extraction and matching; it does not silently override policy.</p><div className="policy-list">{portfolioReport.policy.map((rule: Record<string, unknown>) => <div key={String(rule.id)}><i className={rule.passed ? "pass" : "fail"}>{rule.passed ? "✓" : "!"}</i><span><b>{String(rule.label)}</b><small>{String(rule.id)}</small></span></div>)}</div><div className={`execution-signal ${portfolioReport.state}`}><span>CONTRACT SIGNAL</span><strong>{portfolioReport.state === "verified" ? "ALLOW" : portfolioReport.state === "review" ? "HOLD" : "SUSPEND"}</strong><small>{portfolioReport.state === "suspended" ? "New issuance should remain blocked." : "Policy state may proceed to the registry."}</small></div>{portfolioProofHash && <div className="portfolio-hash"><span>PORTFOLIO FINGERPRINT</span><code>{portfolioProofHash}</code></div>}{!registryAddress && <button className="upload-package deploy-button" type="button" onClick={deployRegistry} disabled={!wallet || deploying}>{deploying ? "Deploying registry…" : !wallet ? "Connect wallet to deploy registry" : "Deploy Duevia registry"}</button>}{!portfolioProofHash ? <button className="anchor-button" type="button" onClick={preparePortfolioAttestation}>Generate portfolio fingerprint</button> : <button className="anchor-button" type="button" onClick={publishPortfolioAttestation} disabled={!wallet || !registryAddress}>{!wallet ? "Connect wallet to publish" : !registryAddress ? "Deploy registry to publish" : "Publish pool state on X Layer"}</button>}{anchorTx && <a className="proof-note" href={`https://www.oklink.com/x-layer-testnet/tx/${anchorTx}`} target="_blank" rel="noreferrer">View X Layer testnet transaction ↗</a>}<small className="proof-note">Raw asset and payment data remains offchain. Only policy, state, validity, and evidence fingerprints are published.</small></aside>
          </div>
        </section>}
        {tab === "Asset verification" && <>
          <section className="case-overview"><div className="overview-copy"><span className={`status-pill ${report.status}`}>{statusLabel[report.status]}</span><h2>Evidence before issuance.</h2><p>{statusCopy[report.status]} Every exception is linked to a source and a policy control.</p></div><div className="score-dial"><strong>{report.score}</strong><span>/ 100</span><small>Assurance score</small></div><div className="overview-metrics"><div><span>Assurance level</span><b className="green">{report.assuranceLevel.slice(0, 2)}</b></div><div><span>Open exceptions</span><b className="amber">{report.counts.high + report.counts.medium}</b></div><div><span>Policy</span><b className="green">V1</b></div></div></section>
          <section className="verification-toolbar"><div className="evidence-source"><span>Evidence package</span><b>{uploadedName}</b><small>Local processing · raw evidence is not written onchain</small></div><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && loadEvidencePackage(event.target.files[0])} /><button className="upload-package" type="button" onClick={() => loadBuiltInScenario(true)}>Load eligible sample</button><button className="run-check" type="button" onClick={runVerification} disabled={running}>{running ? "Evaluating policy…" : "Run assurance policy"}<span>→</span></button></section>
          <div className="status-line"><i className={running ? "scanning" : ""} /><span>{notice}</span></div>
          <section className="module-workspace"><div className="module-panel"><div className="module-panel-head"><div><span>CONTROL {String(report.modules.findIndex((module) => module.id === selected.id) + 1).padStart(2, "0")}</span><h3>{selected.name}</h3><p>{selected.summary}</p></div><div className={`module-score ${selected.status}`}><strong>{selected.score}</strong><span>/100</span></div></div><div className="finding-stack">{selected.findings.length ? selected.findings.map((item) => <article key={`${item.code}-${item.title}`} className={`finding-card ${item.severity}`}><div className="finding-top"><span>{item.severity}</span><code>{item.code}</code></div><h4>{item.title}</h4><p>{item.explanation}</p>{item.evidence?.length > 0 && <div className="evidence-links">{item.evidence.map((evidence) => <button type="button" key={evidence}>↗ {evidence}</button>)}</div>}</article>) : <div className="no-findings">No material exceptions detected in this control.</div>}</div></div>
          <aside className="proof-panel"><span className="proof-label">ASSET ATTESTATION</span><h3>Private evidence. Public status.</h3><p>Duevia publishes a fingerprint, policy, status, and validity window to X Layer—not raw commercial data.</p><div className="hash-box"><span>ATTESTATION FINGERPRINT</span><code>{proofHash || "Run assurance policy to generate"}</code></div><dl><div><dt>Assurance</dt><dd>{report.assuranceLevel}</dd></div><div><dt>Policy</dt><dd>{report.policyId}</dd></div><div><dt>Valid until</dt><dd>{validUntil}</dd></div><div><dt>Network</dt><dd>X Layer Testnet</dd></div></dl>{!registryAddress && <button className="upload-package deploy-button" type="button" onClick={deployRegistry} disabled={!wallet || deploying}>{deploying ? "Deploying registry…" : !wallet ? "Connect wallet to deploy" : "Deploy Duevia testnet registry"}</button>}<button className="anchor-button" type="button" onClick={publishAttestation} disabled={!proofHash || !wallet || !registryAddress || !isAddress(registryAddress)}>{!registryAddress ? "Deploy registry first" : !wallet ? "Connect wallet to attest" : "Publish attestation on X Layer"}</button>{anchorTx && <a className="proof-note" href={`https://www.oklink.com/x-layer-testnet/tx/${anchorTx}`} target="_blank" rel="noreferrer">View testnet transaction ↗</a>}<small className="proof-note">{registryAddress ? `Registry: ${shortAddress(registryAddress)} · stored only in this browser` : "Deploy a personal testnet registry from this browser. Testnet OKB is required."}</small></aside></section>
        </>}
        {tab === "Asset passport" && <section className="detail-view"><div className="detail-heading"><div><span>ASSET PASSPORT</span><h2>Portable assurance profile</h2><p>A decision-ready status for issuers, allocators, and integrated contracts.</p></div><span className={`status-pill ${report.status}`}>{statusLabel[report.status]}</span></div><div className="passport-grid"><div><span>Asset type</span><strong>{String(caseData.asset.type ?? "Trade receivable")}</strong></div><div><span>Reported value</span><strong>{Number(caseData.asset.reportedValue ?? 0).toLocaleString()} USDT</strong></div><div><span>Issuer</span><strong>{String((caseData.issuer as Record<string, unknown>)?.legalName ?? "Unknown")}</strong></div><div><span>Assurance level</span><strong>{report.assuranceLevel}</strong></div><div><span>Policy</span><strong>{report.policyId}</strong></div><div><span>Valid until</span><strong>{validUntil}</strong></div></div><div className="passport-callout"><b>Decision rationale</b><p>{report.disclaimer}</p></div></section>}
        {tab === "Monitoring" && <section className="detail-view"><div className="detail-heading"><div><span>CONTINUOUS CONTROLS</span><h2>Monitoring</h2><p>Evidence should be refreshed before it silently becomes unreliable.</p></div><span className="live-badge"><i /> Policy cadence: daily</span></div><div className="monitor-grid"><div className="monitor-card"><span>Validity window</span><strong>{report.validUntil ? "Active" : "Unset"}</strong><small>{validUntil}</small></div><div className="monitor-card amber-card"><span>Open alerts</span><strong>{report.counts.high + report.counts.medium}</strong><small>Require analyst attention</small></div><div className="monitor-card"><span>Evidence status</span><strong>{report.status === "verified" ? "Current" : "Review"}</strong><small>Based on the current evidence package</small></div></div><div className="timeline-list"><div><b>Now</b><span>Assurance decision generated</span><em>{report.assuranceLevel}</em></div><div><b>Pending</b><span>Payment beneficiary confirmation</span><em>Owner: issuer</em></div><div><b>At expiry</b><span>Registry should move state to stale and block automatic eligibility</span><em>{validUntil}</em></div></div></section>}
        {tab === "Audit trail" && <section className="detail-view"><div className="detail-heading"><div><span>CHAIN OF CUSTODY</span><h2>Audit trail</h2><p>Versioned events for evidence, policy decisions, and X Layer attestations.</p></div></div><div className="timeline-list audit-list"><div><b>Current session</b><span>Attestation fingerprint generated</span><em>{proofHash ? `${proofHash.slice(0, 18)}…` : "Awaiting policy run"}</em></div><div><b>Current session</b><span>Five assurance controls evaluated</span><em>{report.methodology}</em></div><div><b>Current session</b><span>Evidence package loaded</span><em>{uploadedName}</em></div><div><b>Next step</b><span>Publish status to Duevia registry on X Layer Testnet</span><em>{registryAddress ? "Registry configured" : "Registry not configured"}</em></div></div></section>}
      </div>
    </section>
  </main>;
}
