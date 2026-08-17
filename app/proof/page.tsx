import Link from "next/link";
import { dueviaContracts, dueviaGovernanceTransactions, legacyRehearsalTransactions } from "@/lib/deployment-evidence";
import ReleaseProof from "./release-proof";

const explorer = "https://www.oklink.com/x-layer-testnet";

const evidence = [
  ...dueviaContracts.map((contract) => ({ label: contract.label, value: contract.address, href: `${explorer}/address/${contract.address}`, note: `Final deployment · tx ${contract.deploymentTransaction.slice(0, 12)}...` })),
  ...dueviaGovernanceTransactions.map((item) => ({ label: item.label, value: `${item.transaction.slice(0, 12)}...${item.transaction.slice(-6)}`, href: `${explorer}/tx/${item.transaction}`, note: "Multisig-governed ownership evidence" })),
  ...legacyRehearsalTransactions.map((item) => ({ label: item.label, value: `${item.transaction.slice(0, 12)}...${item.transaction.slice(-6)}`, href: `${explorer}/tx/${item.transaction}`, note: "Historical enforcement proof; final-stack rehearsal remains pending" })),
];

export default function ProofPage() {
  return <main className="proof-page">
    <nav className="site-nav shell"><Link className="xray-brand" href="/" aria-label="Duevia RWA home"><span className="xray-mark">D</span><span>DUEVIA RWA</span></Link><div className="site-links"><Link href="/">Product</Link><Link href="/app">DApp</Link><a href="https://github.com/yanwenzhe519-ctrl/duevia-rwa" target="_blank" rel="noreferrer">GitHub</a></div><Link className="nav-cta" href="/app">Open DApp <span>→</span></Link></nav>

    <section className="proof-hero shell">
      <span className="section-index">X LAYER AI SEASON / EVIDENCE</span>
      <h1>Claims should be<br /><em>checkable.</em></h1>
      <p>Duevia publishes only evidence that can be checked in code, on X Layer Testnet, or through its live runtime. Test fixtures and pending deployment work are labelled separately.</p>
      <div className="proof-links"><Link className="button-dark" href="/app">Open live DApp <span>→</span></Link><a className="button-quiet" href="https://github.com/yanwenzhe519-ctrl/duevia-rwa" target="_blank" rel="noreferrer">Inspect source code</a></div>
      <ReleaseProof />
    </section>

    <section className="proof-section shell">
      <div className="proof-heading"><div><span className="section-index">01 / TESTNET PROOF</span><h2>Existing X Layer evidence</h2></div><p>Network: X Layer Testnet, chain ID 1952. Links open the independent explorer rather than a Duevia-controlled dashboard.</p></div>
      <div className="evidence-list">{evidence.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="evidence-row"><div><b>{item.label}</b><small>{item.note}</small></div><code>{item.value}</code><span>View on OKLink →</span></a>)}</div>
    </section>

    <section className="proof-runtime"><div className="shell proof-runtime-grid"><div><span className="section-index light">02 / LIVE RUNTIME</span><h2>Persistent monitoring,<br />not a local demo.</h2></div><div className="runtime-cards"><a href="/api/agent/health" target="_blank" rel="noreferrer"><span>AI investigation</span><b>Workers AI</b><small>Structured output and independent verifier</small></a><a href="/api/watchdog" target="_blank" rel="noreferrer"><span>Continuity watchdog</span><b>D1 + Cron</b><small>X Layer scanner and persistent incident metadata</small></a><a href="/api/recovery" target="_blank" rel="noreferrer"><span>Recovery archive</span><b>Capsule roots</b><small>Public metadata; raw recovery data remains protected</small></a><a href="/api/evidence" target="_blank" rel="noreferrer"><span>Generated evidence</span><b>D1 evidence/v2</b><small>Release, contracts, incidents, roots, blocks, and Keeper runs</small></a></div></div></section>

    <section className="proof-section shell proof-status">
      <div className="proof-heading"><div><span className="section-index">03 / DELIVERY STATUS</span><h2>Verified versus pending</h2></div><p>The final testnet stack and multisig ownership are deployed. Automatic broadcasting remains disabled by design; every material transition requires explicit authorization.</p></div>
      <div className="status-grid"><article className="status-complete"><span>VERIFIED NOW</span><h3>AI, deterministic reconstruction, persistent Keeper, public code, and all six final X Layer Testnet contracts.</h3><p>Registry and Coordinator global and project ownership resolve to the recovery multisig. The live health endpoint publishes the active Keeper sources.</p></article><article className="status-pending"><span>REQUIRED NEXT</span><h3>Run the final-stack incident rehearsal with the authorized project wallet.</h3><p>Record SUSPENDED, Pool rejection, recovery root, successor verification, VERIFIED, and the accepted 1 wei deposit. Historical legacy-stack transactions remain clearly labelled above.</p></article><article className="status-pending"><span>BEFORE MAINNET</span><h3>External contract audit, independent operator organizations, real RWA data adapters, pilot partner, and governance/legal operating controls.</h3><p>Only after these controls exist can automatic SUSPENDED broadcast be considered. It is not enabled today.</p></article></div>
    </section>

    <section className="proof-final"><div className="shell"><span>SUBMISSION MATERIALS</span><h2>Product URL, source code,<br />testnet proof, official X post.</h2><p>The official form also requires team contact details and the project X handle. Submit only after the deployment evidence above is current.</p><a className="button-blue" href="https://docs.google.com/forms/d/e/1FAIpQLSfgU_3zcXdxK0GJQxj33QeUWdEcAaYnieVe9p5cFDb2JFQa4Q/viewform?usp=publish-editor" target="_blank" rel="noreferrer">Open official form <span>→</span></a></div></section>
  </main>;
}
