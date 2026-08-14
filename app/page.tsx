const capabilities = [
  { number: "01", title: "AI investigation", copy: "Start with a goal, issuer, asset, or contract. Duevia plans the investigation and gathers the relevant signals.", meta: "One command, not one form" },
  { number: "02", title: "Asset knowledge graph", copy: "Resolve issuers, debtors, invoices, payments, documents, and contracts into a traceable relationship graph.", meta: "Context before conclusions" },
  { number: "03", title: "Autonomous anomaly hunt", copy: "Continuously investigate duplicate financing, payment conflicts, stale evidence, concentration, and collateral gaps.", meta: "Find what humans miss" },
  { number: "04", title: "Grounded AI analyst", copy: "Ask why a pool is blocked, what changed, and which evidence is missing. Every answer remains linked to source records.", meta: "Explainable by design" },
  { number: "05", title: "Agent-to-contract actions", copy: "Convert verified findings into ALLOW, HOLD, or SUSPEND signals and publish a privacy-preserving state on X Layer.", meta: "Intelligence that executes" },
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
        <div className="xray-kicker"><i /> AGENTIC AI · RWA · X LAYER</div>
        <h1>Investigate assets.<br />Execute trust.</h1>
        <div className="hero-bottom">
          <p>Duevia is an AI investigation and decision layer for RWA. Agents map live asset signals, explain material risk, and turn grounded findings into enforceable X Layer actions.</p>
          <div className="hero-buttons"><a className="button-dark" href="/app">Run Duevia Agent <span>↗</span></a><a className="button-quiet" href="#platform">How it works</a></div>
        </div>
        <div className="hero-proof-bar">
          <div><b>Agentic</b><span>Goal-driven investigation</span></div>
          <div><b>Grounded</b><span>Answers linked to evidence</span></div>
          <div><b>Continuous</b><span>Risk re-evaluated as data changes</span></div>
          <div><b>Executable</b><span>AI findings become contract signals</span></div>
        </div>
      </section>

      <section className="problem-section" id="platform">
        <div className="shell problem-grid">
          <div><span className="section-index">THE GAP / 01</span><h2>RWA risk moves faster than periodic review.</h2></div>
          <div className="problem-copy"><p>Asset signals live across ledgers, banks, servicers, registries, contracts, and public information. Human review is slow, fragmented, and difficult to repeat after issuance.</p><p>Duevia gives every RWA an always-on investigation agent with visible evidence, policy boundaries, and an executable state.</p></div>
        </div>
        <div className="shell signal-rail" aria-label="Duevia agent flow"><span>INVESTIGATION GOAL</span><i>→</i><span>AI ASSET GRAPH</span><i>→</i><span>GROUNDED DECISION</span><i>→</i><span>X LAYER ACTION</span></div>
      </section>

      <section className="modules-section shell" id="workflow">
        <div className="section-heading-row"><div><span className="section-index">THE AGENT / 02</span><h2>One investigation.<br />Five agent capabilities.</h2></div><p>Duevia combines model reasoning with deterministic policy and source-linked evidence. AI proposes; transparent controls and authorized humans decide.</p></div>
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
