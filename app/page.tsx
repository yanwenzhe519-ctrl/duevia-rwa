const capabilities = [
  { number: "01", title: "Evidence intelligence", copy: "Map documents, APIs, statements, and signed records to the asset claims they support.", meta: "Inputs, not just files" },
  { number: "02", title: "Entity & authority", copy: "Check issuer identity, counterparty status, signing authority, and payment beneficiary consistency.", meta: "Who can make the claim?" },
  { number: "03", title: "Asset & cash-flow", copy: "Import an asset tape, detect duplicate financing, reconcile eligible collateral, and track overdue cash flows at receivable level.", meta: "What backs the token?" },
  { number: "04", title: "Policy engine", copy: "Turn a platform’s underwriting requirements into explicit, explainable controls and review gates.", meta: "Rules before scores" },
  { number: "05", title: "Monitor & attest", copy: "Apply freshness and concentration limits, turn exceptions into ALLOW / HOLD / SUSPEND signals, and attest the state on X Layer.", meta: "Proof with a lifetime" },
];

const customers = [
  ["RWA platforms", "Embed asset assurance into onboarding and prevent ineligible assets from reaching issuance workflows."],
  ["Credit originators", "Create a reusable evidence package that helps counterparties assess a receivable or private-credit asset faster."],
  ["Funds & allocators", "Monitor evidence freshness and material exceptions after an asset enters a portfolio."],
];

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="site-nav shell">
        <a className="xray-brand" href="#top" aria-label="Duevia RWA home"><span className="xray-mark">D</span><span>DUEVIA RWA</span></a>
        <div className="site-links"><a href="#platform">Platform</a><a href="#workflow">Workflow</a><a href="#customers">Customers</a></div>
        <a className="nav-cta" href="/app">Open workspace <span>↗</span></a>
      </nav>

      <section className="xray-hero shell" id="top">
        <div className="hero-grid-line line-a" /><div className="hero-grid-line line-b" />
        <div className="xray-kicker"><i /> AI · RWA · X LAYER</div>
        <h1>Verify what<br />backs the asset.</h1>
        <div className="hero-bottom">
          <p>Duevia turns fragmented offchain evidence into policy-enforceable asset assurance—so tokenized private-market assets can be assessed, monitored, and used with clearer conditions on X Layer.</p>
          <div className="hero-buttons"><a className="button-dark" href="/app">Run an assurance check <span>↗</span></a><a className="button-quiet" href="#platform">How it works</a></div>
        </div>
        <div className="hero-proof-bar">
          <div><b>Evidence-first</b><span>Claims linked to sources</span></div>
          <div><b>Policy-led</b><span>Explicit eligibility controls</span></div>
          <div><b>Private</b><span>Raw evidence remains offchain</span></div>
          <div><b>X Layer</b><span>Attestation-ready registry</span></div>
        </div>
      </section>

      <section className="problem-section" id="platform">
        <div className="shell problem-grid">
          <div><span className="section-index">THE GAP / 01</span><h2>A token is not proof of the asset behind it.</h2></div>
          <div className="problem-copy"><p>Private-market RWA data lives across accounting systems, registries, bank records, signed documents, issuer portals, and periodic reports. Onchain issuance alone does not reconcile those sources or tell a smart contract when evidence has expired.</p><p>Duevia is the assurance layer between offchain asset evidence and onchain financial actions.</p></div>
        </div>
        <div className="shell signal-rail" aria-label="Duevia assurance flow"><span>OFFCHAIN EVIDENCE</span><i>→</i><span>AI EXTRACTION + RULES</span><i>→</i><span>ASSET ASSURANCE</span><i>→</i><span>X LAYER ACTION</span></div>
      </section>

      <section className="modules-section shell" id="workflow">
        <div className="section-heading-row"><div><span className="section-index">THE PLATFORM / 02</span><h2>One asset state.<br />Five capabilities.</h2></div><p>Use the whole assurance workflow, or call the evidence, policy, monitoring, and attestation layers from an existing issuance or underwriting process.</p></div>
        <div className="module-list">{capabilities.map((item) => <article key={item.number}><span className="module-number">{item.number}</span><div><h3>{item.title}</h3><small>{item.meta}</small></div><p>{item.copy}</p><span className="module-arrow">↗</span></article>)}</div>
      </section>

      <section className="product-preview">
        <div className="shell preview-grid">
          <div className="preview-copy"><span className="section-index light">ASSET ASSURANCE / 03</span><h2>A status contracts can use,<br />not another PDF summary.</h2><p>Every assurance decision shows its policy, evidence coverage, validity window, and material exceptions. If a required condition fails or expires, the asset state changes visibly.</p><a className="button-light" href="/app">Open the DApp <span>↗</span></a></div>
          <div className="report-mock" aria-label="Example Duevia asset assurance report">
            <div className="mock-top"><span>DUE-INV-2026-0814-07-V1</span><b>MANUAL REVIEW</b></div>
            <div className="mock-score"><strong>L1</strong><span>document-backed<br />assurance level</span></div>
            <div className="mock-factors"><div><span>Evidence coverage</span><b>100%</b></div><div className="warn"><span>Policy controls</span><b>2 open</b></div><div><span>Asset coverage</span><b>100%</b></div><div><span>Validity window</span><b>24h</b></div></div>
            <div className="mock-alert"><i>!</i><div><b>Beneficiary mismatch</b><span>Automatic eligibility remains blocked until a reviewer resolves this condition.</span></div></div>
            <div className="mock-chain"><span className="x-mini">D</span><div><b>Attestation state ready</b><small>Private evidence · public status on X Layer</small></div><em>VALID → REVIEW</em></div>
          </div>
        </div>
      </section>

      <section className="customers-section shell" id="customers">
        <div className="section-heading-row"><div><span className="section-index">WHO PAYS / 04</span><h2>For teams carrying<br />asset verification risk.</h2></div></div>
        <div className="customer-grid">{customers.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="final-cta"><div className="shell"><span>VERIFY BEFORE YOU ISSUE.</span><h2>Turn evidence into<br />actionable assurance.</h2><a className="button-blue" href="/app">Launch Duevia <span>↗</span></a></div></section>
      <footer className="site-footer shell"><div className="xray-brand"><span className="xray-mark">D</span><span>DUEVIA RWA</span></div><p>Asset assurance infrastructure for tokenized private markets.</p><span>Built for X Layer AI Season · 2026</span></footer>
    </main>
  );
}
