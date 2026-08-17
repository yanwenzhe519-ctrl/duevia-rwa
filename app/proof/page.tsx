const explorer = "https://www.oklink.com/x-layer-testnet";

const evidence = [
  { label: "Asset Assurance Registry", value: "0xaa747b92496f6c5f01b9a32d8108da797c85a8c2", href: `${explorer}/address/0xaa747b92496f6c5f01b9a32d8108da797c85a8c2`, note: "X Layer Testnet attestation registry" },
  { label: "Eligibility Guard", value: "0xc7b1ed1d1cd7b1cc485ad9f45b329c68c2a7243a", href: `${explorer}/address/0xc7b1ed1d1cd7b1cc485ad9f45b329c68c2a7243a`, note: "Legacy onchain eligibility enforcement" },
  { label: "Receivables Pool", value: "0xe68b0c11cad7f756a536391ff3632e8956bbcc95", href: `${explorer}/address/0xe68b0c11cad7f756a536391ff3632e8956bbcc95`, note: "Value-bearing testnet integration" },
  { label: "Suspension attestation", value: "0x653d0f...099ba82", href: `${explorer}/tx/0x653d0fb6ae23d2b6425444cab13d551a48b6e44a27e9772ef0a9c2c29099ba82`, note: "Recorded SUSPENDED state" },
  { label: "Verified attestation", value: "0x287658...1bfc55", href: `${explorer}/tx/0x28765800663e1dfa48ecbb9a09ead38673a0c9316e0e8faefc2862d66e1bfc55`, note: "Recorded VERIFIED state" },
  { label: "Guarded 1 wei deposit", value: "0xe525d1...f9a77", href: `${explorer}/tx/0xe525d1b7fa4dc315a0b014c6f5e1d0e8a2fd66ce2bff0b346e37047c403f9a77`, note: "Verified state accepted value after enforcement" },
];

export default function ProofPage() {
  return <main className="proof-page">
    <nav className="site-nav shell"><Link className="xray-brand" href="/" aria-label="Duevia RWA home"><span className="xray-mark">D</span><span>DUEVIA RWA</span></Link><div className="site-links"><Link href="/">Product</Link><Link href="/app">DApp</Link><a href="https://github.com/yanwenzhe519-ctrl/duevia-rwa" target="_blank" rel="noreferrer">GitHub</a></div><Link className="nav-cta" href="/app">Open DApp <span>→</span></Link></nav>

    <section className="proof-hero shell">
      <span className="section-index">X LAYER AI SEASON / EVIDENCE</span>
      <h1>Claims should be<br /><em>checkable.</em></h1>
      <p>Duevia publishes only evidence that can be checked in code, on X Layer Testnet, or through its live runtime. Test fixtures and pending deployment work are labelled separately.</p>
      <div className="proof-links"><Link className="button-dark" href="/app">Open live DApp <span>→</span></Link><a className="button-quiet" href="https://github.com/yanwenzhe519-ctrl/duevia-rwa" target="_blank" rel="noreferrer">Inspect source code</a></div>
    </section>

    <section className="proof-section shell">
      <div className="proof-heading"><div><span className="section-index">01 / TESTNET PROOF</span><h2>Existing X Layer evidence</h2></div><p>Network: X Layer Testnet, chain ID 1952. Links open the independent explorer rather than a Duevia-controlled dashboard.</p></div>
      <div className="evidence-list">{evidence.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="evidence-row"><div><b>{item.label}</b><small>{item.note}</small></div><code>{item.value}</code><span>View on OKLink →</span></a>)}</div>
    </section>

    <section className="proof-runtime"><div className="shell proof-runtime-grid"><div><span className="section-index light">02 / LIVE RUNTIME</span><h2>Persistent monitoring,<br />not a local demo.</h2></div><div className="runtime-cards"><a href="/api/agent/health" target="_blank" rel="noreferrer"><span>AI investigation</span><b>Workers AI</b><small>Structured output and independent verifier</small></a><a href="/api/watchdog" target="_blank" rel="noreferrer"><span>Continuity watchdog</span><b>D1 + Cron</b><small>X Layer scanner and persistent incident metadata</small></a><a href="/api/recovery" target="_blank" rel="noreferrer"><span>Recovery archive</span><b>Capsule roots</b><small>Public metadata; raw recovery data remains protected</small></a><a href="/api/evidence" target="_blank" rel="noreferrer"><span>Generated evidence</span><b>D1 evidence/v1</b><small>Projects, incidents, roots, blocks, and Keeper runs</small></a></div></div></section>

    <section className="proof-section shell proof-status">
      <div className="proof-heading"><div><span className="section-index">03 / DELIVERY STATUS</span><h2>Verified versus pending</h2></div><p>Automatic suspension remains disabled by design until every governance and onchain control is independently deployed and tested.</p></div>
      <div className="status-grid"><article className="status-complete"><span>VERIFIED NOW</span><h3>AI, deterministic reconstruction, persistent Keeper, public code, testnet Registry/Guard/Pool, suspension and restoration attestations.</h3><p>Historical-pattern replays are included as synthetic fixtures. They validate deterministic behavior; they do not claim production loss recovery accuracy.</p></article><article className="status-pending"><span>REQUIRED NEXT</span><h3>Deploy the latest Recovery Coordinator, Dual Guard, and Continuity Pool with the project wallet.</h3><p>Then configure independent observer addresses and recovery multisig, transfer Coordinator ownership, and run a full onchain shadow rehearsal.</p></article><article className="status-pending"><span>BEFORE MAINNET</span><h3>External contract audit, independent Keeper operations, real RWA data adapters, pilot partner, and governance/legal operating controls.</h3><p>Only after these controls exist can automatic SUSPENDED broadcast be considered. It is not enabled today.</p></article></div>
    </section>

    <section className="proof-final"><div className="shell"><span>SUBMISSION MATERIALS</span><h2>Product URL, source code,<br />testnet proof, official X post.</h2><p>The official form also requires team contact details and the project X handle. Submit only after the deployment evidence above is current.</p><a className="button-blue" href="https://docs.google.com/forms/d/e/1FAIpQLSfgU_3zcXdxK0GJQxj33QeUWdEcAaYnieVe9p5cFDb2JFQa4Q/viewform?usp=publish-editor" target="_blank" rel="noreferrer">Open official form <span>→</span></a></div></section>
  </main>;
}
import Link from "next/link";
