const modules = [
  {
    number: "01",
    title: "Document Intelligence",
    copy: "Classify evidence, extract material fields, reconcile amounts, and point every finding back to its source.",
    meta: "Ocrolus-inspired evidence workflow",
  },
  {
    number: "02",
    title: "Entity & Counterparty",
    copy: "Bring issuer, KYB, sanctions, payment-account, and counterparty signals into one review surface.",
    meta: "Provider-ready compliance status",
  },
  {
    number: "03",
    title: "Asset & Cash-flow",
    copy: "Compare reported value, represented supply, payment terms, delivery dates, and cash-flow evidence.",
    meta: "Coverage without false guarantees",
  },
  {
    number: "04",
    title: "Explainable Risk",
    copy: "Turn fragmented evidence into a comparable score with factor breakdowns, reason codes, and review actions.",
    meta: "Methodology before marketing",
  },
  {
    number: "05",
    title: "Monitoring & Proof",
    copy: "Track freshness, preserve report versions, and anchor tamper-evident fingerprints on X Layer.",
    meta: "Private documents, public proof",
  },
];

const useCases = [
  ["RWA issuers", "Prepare a cleaner evidence package before onboarding investors, platforms, or liquidity partners."],
  ["Due-diligence teams", "Triage cases faster and send only material exceptions to qualified human reviewers."],
  ["Lenders & platforms", "Embed modular verification through a repeatable workflow instead of rebuilding it internally."],
];

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="site-nav shell">
        <a className="xray-brand" href="#top" aria-label="X-Ray RWA home">
          <span className="xray-mark">X</span>
          <span>X-RAY RWA</span>
        </a>
        <div className="site-links">
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#customers">Customers</a>
        </div>
        <a className="nav-cta" href="/app">Launch DApp <span>↗</span></a>
      </nav>

      <section className="xray-hero shell" id="top">
        <div className="hero-grid-line line-a" />
        <div className="hero-grid-line line-b" />
        <div className="xray-kicker"><i /> AI · RWA · X LAYER</div>
        <h1>See the risk behind<br />every real-world asset.</h1>
        <div className="hero-bottom">
          <p>
            X-Ray RWA turns fragmented offchain evidence into structured risk intelligence and tamper-evident proof—without putting private documents onchain.
          </p>
          <div className="hero-buttons">
            <a className="button-dark" href="/app">Run a verification <span>↗</span></a>
            <a className="button-quiet" href="#platform">Explore the platform</a>
          </div>
        </div>
        <div className="hero-proof-bar">
          <div><b>5</b><span>Independent modules</span></div>
          <div><b>Traceable</b><span>Finding-to-evidence links</span></div>
          <div><b>Private</b><span>Hashes, not raw documents</span></div>
          <div><b>X Layer</b><span>Testnet-ready proof registry</span></div>
        </div>
      </section>

      <section className="problem-section" id="platform">
        <div className="shell problem-grid">
          <div>
            <span className="section-index">THE PROBLEM / 01</span>
            <h2>Tokenized does not automatically mean verified.</h2>
          </div>
          <div className="problem-copy">
            <p>
              Critical RWA information still lives across PDFs, spreadsheets, issuer portals, bank instructions, and periodic reports. Reviewers spend hours reconstructing the same facts, while investors often see a token before they see the evidence behind it.
            </p>
            <p>
              X-Ray RWA creates a reusable verification layer between offchain evidence and onchain value.
            </p>
          </div>
        </div>
        <div className="shell signal-rail" aria-label="Verification flow">
          <span>OFFCHAIN EVIDENCE</span><i>→</i><span>AI + RULE CHECKS</span><i>→</i><span>EXPLAINABLE RISK</span><i>→</i><span>X LAYER PROOF</span>
        </div>
      </section>

      <section className="modules-section shell" id="workflow">
        <div className="section-heading-row">
          <div><span className="section-index">THE PLATFORM / 02</span><h2>One workflow.<br />Five callable modules.</h2></div>
          <p>Use the full verification pipeline or call one module from an existing underwriting, issuance, or asset-monitoring workflow.</p>
        </div>
        <div className="module-list">
          {modules.map((module) => (
            <article key={module.number}>
              <span className="module-number">{module.number}</span>
              <div><h3>{module.title}</h3><small>{module.meta}</small></div>
              <p>{module.copy}</p>
              <span className="module-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="product-preview">
        <div className="shell preview-grid">
          <div className="preview-copy">
            <span className="section-index light">LIVE PRODUCT / 03</span>
            <h2>A decision surface,<br />not another PDF summary.</h2>
            <p>Every score can be traced to a rule, a field, and a source. Material changes create a new report version instead of silently replacing history.</p>
            <a className="button-light" href="/app">Open the DApp <span>↗</span></a>
          </div>
          <div className="report-mock" aria-label="Example risk report">
            <div className="mock-top"><span>XR-INV-2026-0814-07-V1</span><b>REVIEW REQUIRED</b></div>
            <div className="mock-score"><strong>73</strong><span>/100<br />Evidence score</span></div>
            <div className="mock-factors">
              <div><span>Document intelligence</span><b>100</b></div>
              <div className="warn"><span>Entity & counterparty</span><b>62</b></div>
              <div><span>Asset & cash-flow</span><b>76</b></div>
              <div><span>Monitoring & proof</span><b>100</b></div>
            </div>
            <div className="mock-alert"><i>!</i><div><b>Account holder mismatch</b><span>Issuer and receiving account belong to different entities.</span></div></div>
            <div className="mock-chain"><span className="x-mini">X</span><div><b>Proof fingerprint generated</b><small>Ready for X Layer testnet anchoring</small></div><em>0x8a31…f92c</em></div>
          </div>
        </div>
      </section>

      <section className="customers-section shell" id="customers">
        <div className="section-heading-row">
          <div><span className="section-index">WHO PAYS / 04</span><h2>Built for the people<br />who carry verification risk.</h2></div>
        </div>
        <div className="customer-grid">
          {useCases.map(([title, copy], index) => (
            <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="shell">
          <span>VERIFY BEFORE YOU TRUST.</span>
          <h2>Make every RWA claim<br />easier to inspect.</h2>
          <a className="button-blue" href="/app">Launch X-Ray RWA <span>↗</span></a>
        </div>
      </section>

      <footer className="site-footer shell">
        <div className="xray-brand"><span className="xray-mark">X</span><span>X-RAY RWA</span></div>
        <p>AI-powered verification infrastructure for real-world assets.</p>
        <span>Built for OKX X Layer AI Season · 2026</span>
      </footer>
    </main>
  );
}
