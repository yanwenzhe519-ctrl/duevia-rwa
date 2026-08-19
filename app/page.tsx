import { PublicRecoveryModules } from "@/app/public-recovery-modules";
import { LiveOverview } from "@/app/live-overview";

// Raw telemetry and rehearsal panels remain available in the DApp/proof paths, but are intentionally withheld from the marketing homepage until their public data contract is release-ready.
const showPublicTelemetry = false;

// Investigate assets. Execute continuity. Duevia remains an always-on investigation agent. Five agent capabilities now converge on failover.
const workflow = [
  ["01", "Monitor", "A signed servicing heartbeat is checked against a defined SLA."],
  ["02", "Investigate", "AI and an independent verifier separate supported evidence from gaps."],
  ["03", "Protect", "Deterministic policy gates unsafe actions while the recovery state is reviewed."],
  ["04", "Handoff", "An authorized successor publishes the recovery root and requests the next state."],
];

const customers = [
  ["Small RWA issuers", "Tokenized receivables and private-credit pools that cannot afford a bespoke backup-servicer stack."],
  ["Protocol operators", "Onchain lending and asset-pool teams that need a fail-safe when an offchain counterparty goes dark."],
  ["Successor servicers", "Approved operators who need a portable, verifiable starting point instead of a broken spreadsheet."],
];

const trustSignals = [
  ["AI", "Evidence interpretation", "A model separates supported facts, inferences, evidence gaps, and approval-gated actions."],
  ["D1", "Persistent audit log", "Keeper runs, incidents, observations, and recovery roots are recorded outside the browser session."],
  ["X LAYER", "Policy execution", "Deterministic contracts define what can pause, attest, resume, or remain blocked."],
  ["HUMAN", "Governed handoff", "A successor and its permissions are authorized through an explicit approval boundary."],
];

const faqs = [
  ["What does Duevia actually recover?", "It reconstructs a bounded operational state from supplied evidence. It does not independently establish legal ownership, custody, repayment, or enforceability."],
  ["Can the AI move funds or change policy?", "No. The model proposes an evidence-based plan. Contract policy and authorized governance control state changes; any material broadcast remains governance-controlled."],
  ["What does the public proof contain?", "Public proof contains deployment identity, contract addresses, timestamps, state commitments, and safe summaries. Sensitive borrower and servicing records remain offchain."],
  ["How does Duevia move toward production scale?", "The production path extends the same evidence and policy boundary into custody integrations, mainnet settlement, identity, audit, and dispute workflows."],
  ["Who is the product for?", "RWA issuers, protocol operators, and approved successor servicers that need a governed continuity layer when an offchain service stops responding."],
];

const futureCapabilities = [
  ["01", "Autonomous continuity", "Duevia will close the loop from a missing heartbeat to an approval-ready recovery plan with policy-aware AI."],
  ["02", "Institutional evidence rails", "Servicer, custodian, bank, and legal-data integrations will let recovery attestations travel with the asset."],
  ["03", "Mainnet-grade execution", "The same deterministic boundary will support production pausing, successor handoff, and settlement on X Layer."],
  ["04", "Compliance-native recovery", "Identity, audit, dispute, and evidence lineage will make continuity a standard operating layer for RWA."],
];

export default function Home() {
  return <main className="marketing-page">
    <nav className="site-nav shell"><a className="xray-brand" href="#top" aria-label="Duevia RWA home"><span className="xray-mark">D</span><span>DUEVIA RWA</span></a><div className="site-links"><a href="#problem">Problem</a><a href="#protocol">Protocol</a><a href="#trust">Trust stack</a><a href="#faq">FAQ</a><a href="/proof">Evidence</a></div><a className="nav-cta" href="/app">Open Continuity Agent <span>→</span></a></nav>

    <section className="xray-hero shell continuity-marketing-hero" id="top"><div className="hero-grid-line line-a" /><div className="hero-grid-line line-b" /><div className="xray-kicker"><i /> DUEVIA · AI-POWERED RWA RECOVERY INFRASTRUCTURE</div><div className="hero-layout"><div><h1>Keep tokenized<br />assets<br /><em>operable.</em></h1><p className="hero-lede">Duevia monitors servicing evidence, uses AI to reconstruct a bounded operational state, and routes any pause or handoff through X Layer policy and authorized governance.</p><div className="hero-buttons"><a className="button-dark" href="/app">Open the Continuity Agent <span>→</span></a><a className="button-quiet" href="/proof">Inspect public proof <span>↗</span></a></div></div><LiveOverview /></div><div className="hero-proof-bar"><div><b>Monitor</b><span>Signed heartbeat SLA</span></div><div><b>Investigate</b><span>AI + independent verifier</span></div><div><b>Protect</b><span>Policy gates unsafe actions</span></div><div><b>Handoff</b><span>Successor approval required</span></div></div></section>

    <section className="problem-section" id="problem"><div className="shell problem-grid"><div><span className="section-index">THE FAILURE MODE / 01</span><h2>A token is only as resilient as the service behind it.</h2></div><div className="problem-copy"><p>Tokenization moves ownership and settlement onchain, but servicing still depends on a company, a database, and a recurring report. If that service stops, investors cannot tell whether balances, repayments, or redemptions are still current.</p><p>Duevia turns the service gap into a governed workflow: detect it, investigate the evidence, protect the pool, and prepare a successor handoff without bypassing policy.</p></div></div><div className="shell signal-rail" aria-label="Duevia continuity flow"><span>SERVICE GAP</span><i>→</i><span>AI EVIDENCE REVIEW</span><i>→</i><span>POLICY GATE</span><i>→</i><span>SUCCESSOR HANDOFF</span></div></section>

    <section className="modules-section shell" id="protocol"><div className="section-heading-row"><div><span className="section-index">THE PROTOCOL / 02</span><h2>AI investigates.<br />X Layer enforces.</h2></div><p>AI interprets messy evidence, but it cannot move money or override policy. Deterministic contracts and human approval define the execution boundary.</p></div><div className="module-list">{workflow.map(([number, title, copy]) => <article key={number}><span className="module-number">{number}</span><div><h3>{title}</h3><small>{title === "Investigate" ? "AI model + verifier" : title === "Protect" ? "Policy-gated" : title === "Handoff" ? "Authorized successor" : "Signed evidence"}</small></div><p>{copy}</p><span className="module-arrow">→</span></article>)}</div><div className="decision-boundary"><div><span>AI LAYER</span><strong>Model proposes</strong><small>facts · risk · missing evidence · recovery plan</small></div><i>→</i><div><span>GOVERNANCE LAYER</span><strong>Authorized humans approve</strong><small>successor · policy · permission change</small></div><i>→</i><div><span>X LAYER</span><strong>Contracts enforce</strong><small>attestation · pause · resume · public proof</small></div></div></section>

    <section className="product-preview continuity-preview"><div className="shell preview-grid"><div className="preview-copy"><span className="section-index light">X LAYER EXECUTION / 03</span><h2>A governed recovery<br />state transition.</h2><p>When servicing evidence falls outside its SLA, Duevia prepares an approval-gated recovery attestation for the X Layer registry. Sensitive source records remain offchain; the pool receives a time-bounded, verifiable state commitment.</p><a className="button-light" href="/app">Open the Continuity Agent <span>→</span></a></div><div className="execution-proof-slab"><span>EXECUTION POLICY</span><strong>AI recommends.<br />Governance authorizes.<br />Contracts enforce.</strong><small>Mainnet-ready policy layer · governance-controlled execution · public proof available</small><a href="/proof">Review the evidence path <span>↗</span></a></div></div></section>

    {showPublicTelemetry ? <PublicRecoveryModules /> : null}

    <section className="trust-section" id="trust"><div className="shell"><div className="section-heading-row"><div><span className="section-index">TRUST STACK / 04</span><h2>Evidence at<br />every boundary.</h2></div><p>Duevia is designed so that no single model, operator, or dashboard can silently change the state of an RWA pool.</p></div><div className="trust-layout"><div className="trust-list">{trustSignals.map(([label, title, copy], index) => <article key={label}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{label}</b><h3>{title}</h3><p>{copy}</p></div></article>)}</div><aside className="trust-aside"><span>PRODUCTION PATH</span><h3>Built for the next operating standard.</h3><p>Deployment identity, policy contracts, persistent runtime records, AI decision structure, and public state commitments form the foundation for production scale.</p><p className="trust-limit">The next layer adds custody integrations, legal evidence, identity, settlement, and dispute workflows.</p><a href="/proof">Read the evidence standard <span>↗</span></a></aside></div></div></section>

    <section className="future-section"><div className="shell"><div className="section-heading-row"><div><span className="section-index light">THE NEXT OPERATING STANDARD / 05</span><h2>Continuity for the<br /><em>institutional</em> RWA era.</h2></div><p>Duevia starts with the service outage and grows into the control plane for resilient, evidence-backed asset operations on X Layer.</p></div><div className="future-grid">{futureCapabilities.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>

    <section className="ecosystem-section" id="ecosystem"><div className="shell"><div className="section-heading-row"><div><span className="section-index">PUBLIC BY DESIGN / 06</span><h2>Built to be<br />checked in public.</h2></div><p>Duevia exposes the integration points a reviewer can actually verify, while keeping sensitive servicing data out of the public surface.</p></div><div className="ecosystem-grid">{trustSignals.map(([value, label, copy]) => <article key={label}><strong>{value}</strong><b>{label}</b><p>{copy}</p></article>)}</div><div className="ecosystem-path"><div><span>THE REVIEW PATH</span><b>Product → DApp → Proof → API → Explorer</b></div><div className="ecosystem-links"><a href="/app">Run the DApp <span>→</span></a><a href="/proof">Read the proof <span>→</span></a><a href="/api/evidence" target="_blank" rel="noreferrer">Open evidence API <span>↗</span></a><a href="https://www.xlayer.tech/" target="_blank" rel="noreferrer">X Layer Network <span>↗</span></a></div></div></div></section>

    <section className="customers-section shell" id="customers"><div className="section-heading-row"><div><span className="section-index">WHO PAYS / 07</span><h2>For teams that cannot<br />afford a service outage.</h2></div></div><div className="customer-grid">{customers.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

    <section className="faq-section" id="faq"><div className="shell"><div className="section-heading-row"><div><span className="section-index">FAQ / 08</span><h2>Questions worth asking<br />before you trust it.</h2></div><p>Clear answers for issuers, reviewers, and successor servicers. No claim is larger than the evidence behind it.</p></div><div className="faq-grid">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>

    <section className="final-cta"><div className="shell"><span>AI-POWERED RWA RECOVERY INFRASTRUCTURE</span><h2>Keep the asset<br />operable.</h2><a className="button-blue" href="/app">Launch Duevia <span>→</span></a></div></section><footer className="site-footer shell"><div><div className="xray-brand"><span className="xray-mark">D</span><span>DUEVIA RWA</span></div><p>AI-powered RWA recovery infrastructure for tokenized private credit.</p></div><nav className="footer-links" aria-label="Public project links"><a href="/app">DApp</a><a href="/proof">Proof</a><a href="/api/evidence" target="_blank" rel="noreferrer">Evidence API</a><a href="https://github.com/yanwenzhe519-ctrl/duevia-rwa" target="_blank" rel="noreferrer">GitHub</a></nav><span>Built for X Layer AI Season · 2026</span></footer>
  </main>;
}
