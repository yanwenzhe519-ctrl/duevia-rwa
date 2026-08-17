import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("the public site uses Duevia RWA agentic investigation messaging", async () => {
  const [page, layout, agent, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/app/ai-investigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Investigate assets/);
  assert.match(page, /always-on investigation agent/);
  assert.match(page, /Five agent capabilities/);
  assert.match(agent, /DUEVIA AI INVESTIGATOR/);
  assert.match(agent, /AI proposes/);
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /store: false/);
  assert.match(route, /AbortController/);
  assert.match(route, /Request body must be valid JSON/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(layout, /Duevia RWA/);
  assert.doesNotMatch(page, /ProofFlow|Starter Project|codex-preview/);
});

test("the agent route applies bounded, validated model input", async () => {
  const route = await readFile(new URL("../app/api/agent/route.ts", import.meta.url), "utf8");
  assert.match(route, /slice\(0, 2000\)/);
  assert.match(route, /slice\(0, 30000\)/);
  assert.match(route, /answer\.slice\(0, 12000\)/);
  assert.match(route, /setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
});

test("the temporary Sites skeleton is removed from the finished project", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});

test("the registry preserves private evidence and exposes eligibility", async () => {
  const [contract, artifact, packageJson] = await Promise.all([
    readFile(new URL("../contracts/DueviaAssetAssuranceRegistry.sol", import.meta.url), "utf8"),
    readFile(new URL("../lib/duevia-registry-artifact.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(contract, /evidenceRoot/);
  assert.match(contract, /policyHash/);
  assert.match(contract, /Raw evidence remains offchain/);
  assert.match(contract, /isEligible/);
  assert.match(contract, /function transferOwnership\(address nextOwner\)/);
  assert.match(contract, /function acceptOwnership\(\)/);
  assert.match(contract, /authorizedAttestors\[previousOwner\] = false/);
  assert.match(contract, /authorizedAttestors\[msg\.sender\] = true/);
  assert.doesNotMatch(contract, /address public immutable owner/);
  assert.match(artifact, /"name":"pendingOwner"/);
  assert.match(artifact, /"name":"acceptOwnership"/);
  assert.match(packageJson, /compile-registry\.mjs/);
});

test("the CREATE2 registry salt is exactly 32 bytes", async () => {
  const workspace = await readFile(new URL("../app/app/xray-workspace.tsx", import.meta.url), "utf8");
  const salt = workspace.match(/const registrySalt = `0x([0-9a-f]+)`/i)?.[1];
  assert.equal(salt?.length, 64);
});

test("continuity recovery requires linked suspended and verified attestations", async () => {
  const [workspace, continuity] = await Promise.all([
    readFile(new URL("../app/app/xray-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/app/continuity-agent.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /publishContinuityState\(4\)/);
  assert.match(workspace, /publishContinuityState\(1, previous as Hex\)/);
  assert.match(workspace, /previousAttestation/);
  assert.match(continuity, /Publish SUSPENDED/);
  assert.match(continuity, /Publish successor VERIFIED/);
});

test("recovery coordinator preserves the real-world failure lifecycle", async () => {
  const contract = await readFile(new URL("../contracts/DueviaRecoveryCoordinator.sol", import.meta.url), "utf8");
  assert.match(contract, /enum State \{ None, Suspended, Reconstructed, Review, Restructuring, Verified, Closed \}/);
  assert.match(contract, /function recordRecovery\(bytes32 incidentId, bytes32 recoveryRoot, State nextState\)/);
  assert.match(contract, /function verifySuccessor\(bytes32 incidentId, bytes32 successorAttestation\)/);
  assert.match(contract, /function isCapitalFlowAllowed\(bytes32 incidentId\) external view returns \(bool\)/);
  assert.match(contract, /function transferOwnership\(address nextOwner\)/);
  assert.match(contract, /function acceptOwnership\(\)/);
  assert.match(contract, /operators\[previousOwner\] = false/);
  assert.match(contract, /incidents\[incidentId\]\.state != State\.None\) revert InvalidIncident/);
  assert.match(contract, /incident\.successor == address\(0\)/);
  assert.match(contract, /emit SuccessorVerified\(incidentId, successorAttestation, incident\.successor\)/);
  assert.doesNotMatch(contract, /msg\.sender != incident\.successor/);
});

test("continuity guard and pool require asset and incident eligibility together", async () => {
  const guard = await readFile(new URL("../contracts/DueviaContinuityGuard.sol", import.meta.url), "utf8");
  const pool = await readFile(new URL("../contracts/DueviaContinuityPool.sol", import.meta.url), "utf8");
  assert.match(guard, /registry\.isProjectEligible\(projectId, attestationId, minimumScore\)/);
  assert.match(guard, /coordinator\.isProjectCapitalFlowAllowed\(projectId, incidentId\)/);
  assert.match(pool, /guard\.requireOperational\(attestationId, incidentId\)/);
});

test("independent observer quorum and multisig gate exceptional recovery actions", async () => {
  const quorum = await readFile(new URL("../contracts/DueviaObserverQuorum.sol", import.meta.url), "utf8");
  const multisig = await readFile(new URL("../contracts/DueviaRecoveryMultisig.sol", import.meta.url), "utf8");
  assert.match(quorum, /threshold_ < 2/);
  assert.match(quorum, /votes\[id\] < threshold/);
  assert.match(quorum, /keccak256\(abi\.encode\(incidentId, epoch, reportHash, target, callHash\)\)/);
  assert.match(quorum, /keccak256\(data\)/);
  assert.match(multisig, /approvals\[txHash\] < threshold/);
  assert.match(multisig, /keccak256\(abi\.encode\(block\.chainid, address\(this\)/);
  assert.match(multisig, /threshold_ < 2/);
});

test("the deployment console enforces final governance and ownership handoff", async () => {
  const deployer = await readFile(new URL("../app/app/infrastructure-deployer.tsx", import.meta.url), "utf8");
  assert.match(deployer, /dueviaRecoveryMultisigBytecode/);
  assert.match(deployer, /dueviaObserverQuorumBytecode/);
  assert.match(deployer, /new Set\(normalized\)\.size === 3/);
  assert.match(deployer, /const \[observers, setObservers\]/);
  assert.match(deployer, /!governanceSet\.has/);
  assert.match(deployer, /duevia-observer-addresses/);
  assert.match(deployer, /independenceConfirmed/);
  assert.match(deployer, /"transferOwnership"/);
  assert.match(deployer, /"acceptOwnership"/);
  assert.match(deployer, /authorizedAttestors/);
  assert.match(deployer, /bootstrapOperator/);
  assert.match(deployer, /eth_chainId/);
  assert.match(deployer, /0x7a0/);
  assert.match(deployer, /duevia:xlayer-demo-rwa:v3/);
  assert.match(deployer, /ensureProjectConfiguration/);
  assert.match(deployer, /"registerProject"/);
  assert.match(deployer, /"setProjectAttestor"/);
  assert.match(deployer, /"setProjectOperator"/);
  assert.match(deployer, /continuity-guard-v3/);
  assert.match(deployer, /demoProjectId\]/);
  assert.match(deployer, /transferProjectOwnership/);
  assert.match(deployer, /acceptProjectOwnership/);
  assert.match(deployer, /Start project-level ownership transfers/);
  assert.match(deployer, /Registry project owner/);
  assert.match(deployer, /Coordinator project owner/);
});

test("the receivables pool gates real value-bearing deposits", async () => {
  const contract = await readFile(new URL("../contracts/DueviaReceivablesPool.sol", import.meta.url), "utf8");
  assert.match(contract, /function deposit\(bytes32 attestationId\) external payable/);
  assert.match(contract, /guard\.requireEligible\(attestationId\)/);
  assert.match(contract, /balances\[msg\.sender\] \+= msg\.value/);
  assert.match(contract, /function withdraw\(uint256 amount\)/);
});

test("servicer route uses independent represented supply", async () => {
  const route = await readFile(new URL("../app/api/servicer-feed/route.ts", import.meta.url), "utf8");
  assert.match(route, /tokenSupply: feed\.snapshot\.tokenSupply/);
  assert.doesNotMatch(route, /feed\.assets\.reduce\(.*outstanding/);
});

test("the deployed worker includes durable operations hardening", async () => {
  const [worker, migration, operationsRunbook, securityReview, viteConfig] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0007_operations_hardening.sql", import.meta.url), "utf8"),
    readFile(new URL("../docs/OPERATIONS_RUNBOOK.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/SECURITY_REVIEW.md", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(worker, /\/api\/operations\/health/);
  assert.match(worker, /observer_endpoints_json/);
  assert.match(worker, /trigger_source/);
  assert.match(worker, /servicer_feed_receipts/);
  assert.match(worker, /ObserverReplayRejected/);
  assert.match(worker, /Keeper lease ownership was lost/);
  assert.match(worker, /endpoint = normalizePublicEndpoint\(project\.public_endpoint\)/);
  assert.match(worker, /observerStatusApi/);
  assert.match(worker, /DUEVIA_OBSERVER_PRIVATE_KEY/);
  assert.match(worker, /duevia\.observer-status\/v1/);
  assert.match(worker, /account\.signMessage/);
  assert.match(worker, /service-observer:/);
  assert.match(worker, /evidenceApi/);
  assert.match(worker, /duevia\.evidence\/v1/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS servicer_feed_receipts/);
  assert.match(migration, /ADD COLUMN observer_endpoints_json/);
  assert.match(migration, /ADD COLUMN trigger_source/);
  assert.match(operationsRunbook, /Keeper/);
  assert.match(securityReview, /independent audit/i);
  assert.match(viteConfig, /database_name:\s*["']duevia-watchdog["'][\s\S]*?migrations_dir:\s*["']\.\/drizzle["']/);
});
