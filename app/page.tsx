import { PublicRecoveryModules } from "@/app/public-recovery-modules";
import { LiveOverview } from "@/app/live-overview";
import { HeroMotion } from "@/app/hero-motion";

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

const verifiedResults = [
  ["6", "Final contracts deployed"],
  ["7", "Onchain recovery actions"],
  ["56", "Application tests passed"],
  ["17", "Contract tests passed"],
  ["4,096", "Invariant calls · 0 reverts"],
  ["5m", "Persistent Keeper cadence"],
];

const investigationTrace = [
  ["01 · What failed?", "Servicing evidence exceeded its defined heartbeat SLA."],
  ["02 · What evidence supports it?", "Signed feed state and independent observations support the incident."],
  ["03 · What is proposed?", "Protect new capital flows and prepare a versioned Recovery Capsule."],
  ["04 · Who approves?", "Authorized governance and the successor control every material transition."],
];

const infrastructureDifferences = [
  ["Failure signal", "Shows that data is stale or a service is offline.", "Corroborates a servicing outage across signed evidence, independent observations, and policy thresholds."],
  ["AI role", "Summarizes alerts for an operator.", "Builds a schema-constrained investigation, cites evidence, and fails closed unless an independent verifier agrees."],
  ["Recovery state", "Leaves the response in tickets, chats, and spreadsheets.", "Produces a versioned Recovery Capsule and deterministic recovery root that a successor can inspect and continue."],
  ["Execution", "Stops at a notification or manual runbook.", "Connects the recovery decision to X Layer contracts that gate attestation, pause, handoff, resume, and redemption."],
  ["Control", "Relies on a platform administrator.", "Separates AI recommendation, multisig authorization, observer evidence, and deterministic contract enforcement."],
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
  return <main className="marketing-page" id="main-content">
    <a className="skip-link" href="#top">Skip to product overview</a>
    <nav className="site-nav shell" aria-label="Primary navigation"><a className="xray-brand" href="#top" aria-label="Duevia RWA home"><span className="xray-mark">D</span><span>DUEVIA RWA</span></a><div className="site-links"><a href="#problem">Problem</a><a href="#protocol">Protocol</a><a href="#difference">Why Duevia</a><a href="#trust">Trust stack</a><a href="/proof">Evidence</a></div><a className="nav-cta" href="/app">Open Continuity Agent <span>→</span></a></nav>

    <section className="xray-hero shell continuity-marketing-hero" id="top"><HeroMotion /><div className="hero-grid-line line-a" /><div className="hero-grid-line line-b" /><div className="xray-kicker" data-hero-reveal><i /> DUEVIA · THE CONTINUITY LAYER FOR TOKENIZED ASSETS</div><div className="hero-layout"><div><div className="hero-eyebrow" data-hero-reveal><span>LIVE ON X LAYER TESTNET</span><span>GOVERNANCE-GATED</span></div><h1 data-hero-reveal>RWA continuity,<br />built into<br /><em>the asset.</em></h1><p className="hero-lede" data-hero-reveal>Duevia is AI-powered recovery infrastructure for real-world assets. When a servicer goes dark, it reconstructs a verifiable operating state and coordinates a governance-controlled takeover on X Layer, so capital does not depend on one company, database, or dashboard.</p><div className="hero-buttons" data-hero-reveal><a className="button-dark" href="/app">Open control room <span>→</span></a><a className="button-quiet" href="/proof">Inspect public proof <span>↗</span></a></div></div><div data-hero-reveal><LiveOverview /></div></div><div className="hero-proof-bar hero-results-bar" aria-label="Verified Duevia delivery results" data-hero-reveal>{verifiedResults.map(([value, label]) => <a className="verified-result" href="/proof" key={label} aria-label={`Verify ${value} ${label} in the public proof`}><b>{value}</b><span>{label}</span><small>View proof ↗</small></a>)}</div></section>

    <section className="problem-section" id="problem"><div className="shell problem-grid"><div><span className="section-index">THE HIDDEN FAILURE MODE / 01</span><h2>Every RWA has an offchain single point of failure.</h2></div><div className="problem-copy"><p>Tokenization puts ownership and settlement onchain, but the asset still depends on offchain servicing: payment records, borrower balances, reconciliations, reporting, and redemption operations. When that service disappears, the token survives while its operating truth does not.</p><p>Duevia makes continuity part of the asset stack: detect the service gap, reconstruct the evidence, protect unsafe flows, and hand operations to an authorized successor without letting AI or a single operator bypass policy.</p></div></div><div className="shell signal-rail" aria-label="Duevia continuity flow"><span>SERVICER FAILURE</span><i>→</i><span>VERIFIABLE STATE</span><i>→</i><span>POLICY PROTECTION</span><i>→</i><span>SUCCESSOR OPERATIONS</span></div></section>

    <section className="modules-section shell" id="protocol"><div className="section-heading-row"><div><span className="section-index">THE PROTOCOL / 02</span><h2>AI investigates.<br />X Layer enforces.</h2></div><p>AI interprets messy evidence, but it cannot move money or override policy. Deterministic contracts and human approval define the execution boundary.</p></div><div className="investigation-trace"><div className="investigation-trace-intro"><span>EVIDENCE-GROUNDED AI TRACE</span><strong>One outage.<br />Four accountable questions.</strong><small>Public testnet recovery workflow</small></div>{investigationTrace.map(([question, answer]) => <div className="investigation-trace-step" key={question}><span>{question}</span><b>{answer}</b></div>)}</div><div className="module-list">{workflow.map(([number, title, copy]) => <article key={number}><span className="module-number">{number}</span><div><h3>{title}</h3><small>{title === "Investigate" ? "AI model + verifier" : title === "Protect" ? "Policy-gated" : title === "Handoff" ? "Authorized successor" : "Signed evidence"}</small></div><p>{copy}</p><span className="module-arrow">→</span></article>)}</div><div className="decision-boundary"><div><span>AI LAYER</span><strong>Model proposes</strong><small>facts · risk · missing evidence · recovery plan</small></div><i>→</i><div><span>GOVERNANCE LAYER</span><strong>Authorized humans approve</strong><small>successor · policy · permission change</small></div><i>→</i><div><span>X LAYER</span><strong>Contracts enforce</strong><small>attestation · pause · resume · public proof</small></div></div></section>

    <section className="product-preview continuity-preview"><div className="shell preview-grid"><div className="preview-copy"><span className="section-index light">X LAYER EXECUTION / 03</span><h2>A governed recovery<br />state transition.</h2><p>When servicing evidence falls outside its SLA, Duevia prepares an approval-gated recovery attestation for the X Layer registry. Sensitive source records remain offchain; the pool receives a time-bounded, verifiable state commitment.</p><a className="button-light" href="/app">Open the Continuity Agent <span>→</span></a></div><div className="execution-proof-slab"><span>EXECUTION POLICY</span><strong>AI recommends.<br />Governance authorizes.<br />Contracts enforce.</strong><small>Built toward mainnet-grade operations · proven on X Layer Testnet · public proof available</small><a href="/proof">Review the evidence path <span>↗</span></a></div></div></section>

    <section className="difference-section" id="difference"><div className="shell"><div className="section-heading-row"><div><span className="section-index">WHY DUEVIA / 04</span><h2>More than monitoring.<br />A recovery control plane.</h2></div><p>A monitoring product tells you that a servicer stopped. Duevia gives the protocol a governed path from first evidence gap to reconstructed state, protected capital flows, and successor operations.</p></div><table className="difference-table"><caption>How Duevia differs from conventional monitoring tools</caption><thead><tr><th scope="col">Capability</th><th scope="col">Conventional monitoring</th><th scope="col">Duevia continuity infrastructure</th></tr></thead><tbody>{infrastructureDifferences.map(([capability, conventional, duevia]) => <tr key={capability}><th scope="row">{capability}</th><td><small>Conventional monitoring</small>{conventional}</td><td><small>Duevia</small>{duevia}</td></tr>)}</tbody></table></div></section>

    {showPublicTelemetry ? <PublicRecoveryModules /> : null}

    <section className="trust-section" id="trust"><div className="shell"><div className="section-heading-row"><div><span className="section-index">TRUST STACK / 05</span><h2>Evidence at<br />every boundary.</h2></div><p>Duevia is designed so that no single model, operator, or dashboard can silently change the state of an RWA pool.</p></div><div className="trust-layout"><div className="trust-list">{trustSignals.map(([label, title, copy], index) => <article key={label}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{label}</b><h3>{title}</h3><p>{copy}</p></div></article>)}</div><aside className="trust-aside"><span>THE CATEGORY VISION</span><h3>The recovery standard tokenized assets should have shipped with.</h3><p>Deployment identity, policy contracts, persistent runtime records, evidence-constrained AI, and public state commitments form a portable continuity layer for RWA.</p><p className="trust-limit">The production path extends this control plane into custody, legal evidence, identity, settlement, and dispute workflows.</p><a href="/proof">Read the evidence standard <span>↗</span></a></aside></div></div></section>

    <section className="future-section"><div className="shell"><div className="section-heading-row"><div><span className="section-index light">THE NEXT OPERATING STANDARD / 06</span><h2>Continuity for the<br /><em>institutional</em> RWA era.</h2></div><p>Duevia starts with the service outage and grows into the control plane for resilient, evidence-backed asset operations on X Layer.</p></div><div className="future-grid">{futureCapabilities.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>

    <section className="ecosystem-section" id="ecosystem"><div className="shell"><div className="section-heading-row"><div><span className="section-index">PUBLIC BY DESIGN / 07</span><h2>Built to be<br />checked in public.</h2></div><p>Duevia exposes the integration points a reviewer can actually verify, while keeping sensitive servicing data out of the public surface.</p></div><div className="ecosystem-grid">{trustSignals.map(([value, label, copy]) => <article key={label}><strong>{value}</strong><b>{label}</b><p>{copy}</p></article>)}</div><div className="ecosystem-path"><div><span>THE REVIEW PATH</span><b>Product → DApp → Proof → API → Explorer</b></div><div className="ecosystem-links"><a href="/app">Run the DApp <span>→</span></a><a href="/proof">Read the proof <span>→</span></a><a href="/api/evidence" target="_blank" rel="noreferrer">Open evidence API <span>↗</span></a><a href="https://www.xlayer.tech/" target="_blank" rel="noreferrer">X Layer Network <span>↗</span></a></div></div></div></section>

    <section className="customers-section shell" id="customers"><div className="section-heading-row"><div><span className="section-index">WHO NEEDS IT / 08</span><h2>For teams that cannot<br />afford a service outage.</h2></div></div><div className="customer-grid">{customers.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

    <section className="faq-section" id="faq"><div className="shell"><div className="section-heading-row"><div><span className="section-index">FAQ / 09</span><h2>Questions worth asking<br />before you trust it.</h2></div><p>Clear answers for issuers, reviewers, and successor servicers. Every live claim links back to public evidence.</p></div><div className="faq-grid">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>

    <section className="final-cta"><div className="shell"><span>AI-POWERED RWA RECOVERY INFRASTRUCTURE</span><h2>Keep the asset<br />operable.</h2><a className="button-blue" href="/app">Launch Duevia <span>→</span></a></div></section><footer className="site-footer shell"><div><div className="xray-brand"><span className="xray-mark">D</span><span>DUEVIA RWA</span></div><p>AI-powered RWA recovery infrastructure for tokenized private credit.</p></div><nav className="footer-links" aria-label="Public project links"><a href="/app">DApp</a><a href="/proof">Proof</a><a href="/api/evidence" target="_blank" rel="noreferrer">Evidence API</a><a href="https://github.com/yanwenzhe519-ctrl/duevia-rwa" target="_blank" rel="noreferrer">GitHub</a></nav><span>Built for X Layer AI Season · 2026</span></footer>
  </main>;
}
