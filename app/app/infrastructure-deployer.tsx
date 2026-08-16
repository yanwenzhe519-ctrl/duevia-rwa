"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, encodeDeployData, encodeFunctionData, getCreate2Address, http, isAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { dueviaRegistryAbi } from "@/lib/duevia-registry-artifact";
import { dueviaRecoveryAbi, dueviaRecoveryBytecode } from "@/lib/duevia-recovery-artifact";
import { dueviaContinuityGuardAbi, dueviaContinuityGuardBytecode } from "@/lib/duevia-continuity-guard-artifact";
import { dueviaContinuityPoolAbi, dueviaContinuityPoolBytecode } from "@/lib/duevia-continuity-pool-artifact";
import { dueviaObserverQuorumAbi, dueviaObserverQuorumBytecode } from "@/lib/duevia-observer-quorum-artifact";
import { dueviaRecoveryMultisigAbi, dueviaRecoveryMultisigBytecode } from "@/lib/duevia-recovery-multisig-artifact";

type EthereumProvider = { request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown> };
declare global { interface Window { ethereum?: EthereumProvider } }

const chain = { id: 1952, name: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } }, blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" } } } as const;
const factory = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address;
const projectWallet = "0x05667de34ad47bafe8a8b976c19809cadf7719d2";
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const publicClient = createPublicClient({ chain, transport: http("https://testrpc.xlayer.tech") });

type DeploymentResult = { address: Address; transactionHash?: Hex; blockNumber?: bigint };
type GovernanceAudit = { registryOwner: string; coordinatorOwner: string; bootstrapAttestor: boolean; bootstrapOperator: boolean };

async function activeAccount() {
  if (!window.ethereum) throw new Error("Wallet provider unavailable");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (String(chainId).toLowerCase() !== "0x7a0") throw new Error("Switch the wallet to X Layer Testnet (chain ID 1952)");
  const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
  if (!accounts[0] || !isAddress(accounts[0])) throw new Error("Connect an EVM wallet first");
  return accounts[0] as Address;
}

async function create2Deploy(account: Address, bytecode: Hex, abi: readonly unknown[], args: readonly unknown[], label: string): Promise<DeploymentResult> {
  if (!window.ethereum) throw new Error("Wallet provider unavailable");
  const initCode = encodeDeployData({ abi, bytecode, args });
  const salt = keccak256(stringToHex(`duevia:${label}:v2:${account.toLowerCase()}`));
  const predicted = getCreate2Address({ from: factory, salt, bytecodeHash: keccak256(initCode) });
  const existing = await publicClient.getBytecode({ address: predicted });
  if (existing && existing !== "0x") return { address: predicted };
  const client = createWalletClient({ chain, transport: custom(window.ethereum) });
  const transactionHash = await client.sendTransaction({ account, to: factory, data: `${salt}${initCode.slice(2)}` as Hex });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  const code = await publicClient.getBytecode({ address: predicted });
  if (!code || code === "0x") throw new Error(`${label} deployment produced no code`);
  return { address: predicted, transactionHash, blockNumber: receipt.blockNumber };
}

async function write(account: Address, address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[]) {
  if (!window.ethereum) throw new Error("Wallet provider unavailable");
  const client = createWalletClient({ chain, transport: custom(window.ethereum) });
  const hash = await client.writeContract({ account, address, abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} transaction reverted`);
  return { hash, blockNumber: receipt.blockNumber };
}

function saveResult(label: string, result: DeploymentResult) {
  const current = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}") as Record<string, unknown>;
  current[label] = { address: result.address, transactionHash: result.transactionHash || null, blockNumber: result.blockNumber?.toString() || null };
  localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
}

export default function InfrastructureDeployer({ wallet, registryAddress }: { wallet: string; registryAddress: string }) {
  const [coordinator, setCoordinator] = useState("");
  const [continuityGuard, setContinuityGuard] = useState("");
  const [continuityPool, setContinuityPool] = useState("");
  const [multisig, setMultisig] = useState("");
  const [quorum, setQuorum] = useState("");
  const [governance, setGovernance] = useState([projectWallet, "", ""]);
  const [observers, setObservers] = useState(["", "", ""]);
  const [independenceConfirmed, setIndependenceConfirmed] = useState(false);
  const [notice, setNotice] = useState("Deploy the final recovery stack with the authorized project wallet.");
  const [running, setRunning] = useState(false);
  const [audit, setAudit] = useState<GovernanceAudit | null>(null);
  const [runtime, setRuntime] = useState({ persistent: false, operationsStatus: "CHECKING", failoverStatus: "UNPROVEN", keeperRuns: 0, model: "checking", incidents: 0, capsules: 0, queuedActions: 0 });

  const validGovernance = useMemo(() => {
    if (!governance.every((value) => isAddress(value))) return false;
    const normalized = governance.map((value) => value.toLowerCase());
    return new Set(normalized).size === 3 && normalized.includes(projectWallet);
  }, [governance]);
  const validObservers = useMemo(() => {
    if (!observers.every((value) => isAddress(value))) return false;
    const observerSet = new Set(observers.map((value) => value.toLowerCase()));
    const governanceSet = new Set(governance.map((value) => value.toLowerCase()));
    return observerSet.size === 3 && observers.every((value) => !governanceSet.has(value.toLowerCase()));
  }, [governance, observers]);
  const validConfiguration = independenceConfirmed && validGovernance && validObservers;

  useEffect(() => {
    // Restore browser-owned deployment state after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCoordinator(localStorage.getItem("duevia-recovery-coordinator-v2") || "");
    setContinuityGuard(localStorage.getItem("duevia-continuity-guard-v2") || "");
    setContinuityPool(localStorage.getItem("duevia-continuity-pool-v2") || "");
    setMultisig(localStorage.getItem("duevia-recovery-multisig-v2") || "");
    setQuorum(localStorage.getItem("duevia-observer-quorum-v2") || "");
    const saved = JSON.parse(localStorage.getItem("duevia-governance-addresses") || "null") as unknown;
    if (Array.isArray(saved) && saved.length === 3 && saved.every((value) => typeof value === "string")) setGovernance(saved);
    const savedObservers = JSON.parse(localStorage.getItem("duevia-observer-addresses") || "null") as unknown;
    if (Array.isArray(savedObservers) && savedObservers.length === 3 && savedObservers.every((value) => typeof value === "string")) setObservers(savedObservers);
    Promise.all([fetch("/api/watchdog").then((response) => response.json()), fetch("/api/operations/health").then((response) => response.json()), fetch("/api/agent/health").then((response) => response.json()), fetch("/api/recovery").then((response) => response.json()), fetch("/api/execution").then((response) => response.json())]).then(([watchdog, operations, ai, recovery, execution]) => setRuntime({ persistent: Boolean(operations.persistent), operationsStatus: operations.status || "UNAVAILABLE", failoverStatus: operations.failover?.status || "UNPROVEN", keeperRuns: Array.isArray(watchdog.keeperRuns) ? watchdog.keeperRuns.length : 0, model: ai.mode || "unavailable", incidents: Array.isArray(watchdog.incidents) ? watchdog.incidents.length : 0, capsules: Array.isArray(recovery.capsules) ? recovery.capsules.length : 0, queuedActions: Array.isArray(execution.actions) ? execution.actions.length : 0 })).catch(() => setRuntime({ persistent: false, operationsStatus: "UNAVAILABLE", failoverStatus: "UNPROVEN", keeperRuns: 0, model: "unavailable", incidents: 0, capsules: 0, queuedActions: 0 }));
  }, []);

  const requireBootstrap = async () => {
    const account = await activeAccount();
    if (account.toLowerCase() !== projectWallet) throw new Error(`Use the project wallet ${projectWallet}`);
    if (wallet && wallet.toLowerCase() !== projectWallet) throw new Error("Reconnect the project wallet in Duevia");
    return account;
  };

  const deploy = async (kind: "coordinator" | "guard" | "pool" | "multisig" | "quorum") => {
    setRunning(true);
    try {
      const account = await requireBootstrap();
      let result: DeploymentResult;
      if (kind === "coordinator") result = await create2Deploy(account, dueviaRecoveryBytecode, dueviaRecoveryAbi, [account], "recovery-coordinator");
      else if (kind === "guard") {
        if (!isAddress(registryAddress) || !isAddress(coordinator)) throw new Error("Deploy Registry and Coordinator first");
        result = await create2Deploy(account, dueviaContinuityGuardBytecode, dueviaContinuityGuardAbi, [registryAddress as Address, coordinator as Address, 80], "continuity-guard");
      } else if (kind === "pool") {
        if (!isAddress(continuityGuard)) throw new Error("Deploy Dual Guard first");
        result = await create2Deploy(account, dueviaContinuityPoolBytecode, dueviaContinuityPoolAbi, [continuityGuard as Address], "continuity-pool");
      } else {
        if (!validConfiguration) throw new Error("Enter three governance addresses and three non-overlapping observer addresses, then confirm independent control");
        localStorage.setItem("duevia-governance-addresses", JSON.stringify(governance));
        localStorage.setItem("duevia-observer-addresses", JSON.stringify(observers));
        result = kind === "multisig"
          ? await create2Deploy(account, dueviaRecoveryMultisigBytecode, dueviaRecoveryMultisigAbi, [governance as Address[], 2], "recovery-multisig")
          : await create2Deploy(account, dueviaObserverQuorumBytecode, dueviaObserverQuorumAbi, [observers as Address[], 2], "observer-quorum");
      }
      saveResult(kind, result);
      if (kind === "coordinator") { setCoordinator(result.address); localStorage.setItem("duevia-recovery-coordinator-v2", result.address); }
      if (kind === "guard") { setContinuityGuard(result.address); localStorage.setItem("duevia-continuity-guard-v2", result.address); }
      if (kind === "pool") { setContinuityPool(result.address); localStorage.setItem("duevia-continuity-pool-v2", result.address); }
      if (kind === "multisig") { setMultisig(result.address); localStorage.setItem("duevia-recovery-multisig-v2", result.address); }
      if (kind === "quorum") { setQuorum(result.address); localStorage.setItem("duevia-observer-quorum-v2", result.address); }
      setNotice(`${kind} ready at ${result.address}${result.transactionHash ? ` · tx ${result.transactionHash}` : " · existing deployment verified"}`);
    } catch (error) { setNotice(`${kind} failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const startOwnershipTransfer = async () => {
    setRunning(true);
    try {
      const account = await requireBootstrap();
      if (!isAddress(registryAddress) || !isAddress(coordinator) || !isAddress(multisig)) throw new Error("Registry, Coordinator, and Multisig are required");
      const registryTx = await write(account, registryAddress as Address, dueviaRegistryAbi, "transferOwnership", [multisig as Address]);
      const coordinatorTx = await write(account, coordinator as Address, dueviaRecoveryAbi, "transferOwnership", [multisig as Address]);
      const current = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}") as Record<string, unknown>;
      current.ownershipTransferStarted = { registryTransactionHash: registryTx.hash, registryBlockNumber: registryTx.blockNumber.toString(), coordinatorTransactionHash: coordinatorTx.hash, coordinatorBlockNumber: coordinatorTx.blockNumber.toString() };
      localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
      setNotice(`Ownership transfer started · Registry ${registryTx.hash} · Coordinator ${coordinatorTx.hash}`);
      await refreshAudit();
    } catch (error) { setNotice(`Ownership transfer failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const takeoverData = (target: "registry" | "coordinator") => encodeFunctionData({ abi: target === "registry" ? dueviaRegistryAbi : dueviaRecoveryAbi, functionName: "acceptOwnership" });

  const approveTakeover = async (target: "registry" | "coordinator") => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!validGovernance || !governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect one of the configured governance signers");
      const targetAddress = target === "registry" ? registryAddress : coordinator;
      if (!isAddress(multisig) || !isAddress(targetAddress)) throw new Error("Target deployment is missing");
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "approve", [targetAddress as Address, BigInt(0), takeoverData(target)]);
      setNotice(`${target} takeover approved by ${account} · ${result.hash}. Switch to another independent signer for the second approval.`);
    } catch (error) { setNotice(`Approval failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const executeTakeover = async (target: "registry" | "coordinator") => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect a configured governance signer");
      const targetAddress = target === "registry" ? registryAddress : coordinator;
      if (!isAddress(multisig) || !isAddress(targetAddress)) throw new Error("Target deployment is missing");
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "execute", [targetAddress as Address, BigInt(0), takeoverData(target)]);
      const current = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}") as Record<string, unknown>;
      current[`${target}OwnershipAccepted`] = { transactionHash: result.hash, blockNumber: result.blockNumber.toString() };
      localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
      setNotice(`${target} ownership accepted by Multisig · ${result.hash}`);
      await refreshAudit();
    } catch (error) { setNotice(`Execution failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const refreshAudit = async () => {
    if (!isAddress(registryAddress) || !isAddress(coordinator)) return setNotice("Registry and Coordinator are required for the ownership audit");
    try {
      const [registryOwner, coordinatorOwner, bootstrapAttestor, bootstrapOperator] = await Promise.all([
        publicClient.readContract({ address: registryAddress as Address, abi: dueviaRegistryAbi, functionName: "owner" }),
        publicClient.readContract({ address: coordinator as Address, abi: dueviaRecoveryAbi, functionName: "owner" }),
        publicClient.readContract({ address: registryAddress as Address, abi: dueviaRegistryAbi, functionName: "authorizedAttestors", args: [projectWallet as Address] }),
        publicClient.readContract({ address: coordinator as Address, abi: dueviaRecoveryAbi, functionName: "operators", args: [projectWallet as Address] }),
      ]);
      setAudit({ registryOwner: String(registryOwner), coordinatorOwner: String(coordinatorOwner), bootstrapAttestor: Boolean(bootstrapAttestor), bootstrapOperator: Boolean(bootstrapOperator) });
      setNotice("Onchain governance state refreshed from X Layer Testnet.");
    } catch (error) { setNotice(`Audit failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
  };

  return <div className="infrastructure-panel">
    <div className="panel-title"><div><span>X LAYER INFRASTRUCTURE</span><h3>Autonomous continuity runtime</h3></div><b>{runtime.operationsStatus === "HEALTHY" && runtime.model === "model-grounded" ? "LIVE" : "PARTIAL"}</b></div>
    <div className="monitor-grid"><div className="monitor-card"><span>Keeper operations</span><strong>{runtime.operationsStatus}</strong><small>{runtime.keeperRuns} runs · failover {runtime.failoverStatus}</small></div><div className="monitor-card"><span>AI investigator</span><strong>{runtime.model === "model-grounded" ? "MODEL LIVE" : "FALLBACK"}</strong><small>Structured output + verifier</small></div><div className="monitor-card"><span>Recovery state</span><strong>{runtime.incidents} incidents</strong><small>{runtime.capsules} capsules · {runtime.queuedActions} approval queue</small></div><div className="monitor-card"><span>Coordinator</span><strong>{coordinator ? short(coordinator) : "NOT DEPLOYED"}</strong><small>X Layer Testnet</small></div></div>
    <div className="continuity-buttons"><button className="upload-package" type="button" onClick={() => deploy("coordinator")} disabled={running || Boolean(coordinator)}>Deploy Coordinator</button><button className="upload-package" type="button" onClick={() => deploy("guard")} disabled={running || !coordinator || !registryAddress || Boolean(continuityGuard)}>Deploy Dual Guard</button><button className="anchor-button" type="button" onClick={() => deploy("pool")} disabled={running || !continuityGuard || Boolean(continuityPool)}>Deploy Continuity Pool</button></div>
    <div className="governance-console">
      <div className="governance-heading"><span>2-OF-3 GOVERNANCE + OBSERVER QUORUM</span><strong>{validConfiguration ? "CONFIGURATION VALID" : "SEPARATE THE CONTROL PLANES"}</strong></div>
      <div className="governance-inputs">{governance.map((value, index) => <label key={index}><span>Governance signer {index + 1}</span><input value={value} onChange={(event) => setGovernance((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value.trim() : item))} spellCheck={false} /></label>)}</div>
      <div className="governance-inputs observer-inputs">{observers.map((value, index) => <label key={index}><span>Independent observer {index + 1}</span><input value={value} onChange={(event) => setObservers((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value.trim() : item))} spellCheck={false} /></label>)}</div>
      <label className="governance-confirm"><input type="checkbox" checked={independenceConfirmed} onChange={(event) => setIndependenceConfirmed(event.target.checked)} /><span>I confirm these addresses are controlled independently.</span></label>
      <div className="continuity-buttons"><button type="button" className="upload-package" onClick={() => deploy("multisig")} disabled={running || !validConfiguration || Boolean(multisig)}>Deploy Recovery Multisig</button><button type="button" className="upload-package" onClick={() => deploy("quorum")} disabled={running || !validConfiguration || Boolean(quorum)}>Deploy Observer Quorum</button><button type="button" className="anchor-button" onClick={startOwnershipTransfer} disabled={running || !multisig || !coordinator || !registryAddress}>Start both ownership transfers</button></div>
      <div className="governance-actions"><div><span>Registry takeover</span><button type="button" onClick={() => approveTakeover("registry")} disabled={running || !multisig}>Approve</button><button type="button" onClick={() => executeTakeover("registry")} disabled={running || !multisig}>Execute after 2 approvals</button></div><div><span>Coordinator takeover</span><button type="button" onClick={() => approveTakeover("coordinator")} disabled={running || !multisig}>Approve</button><button type="button" onClick={() => executeTakeover("coordinator")} disabled={running || !multisig}>Execute after 2 approvals</button></div></div>
      <button type="button" className="audit-refresh" onClick={refreshAudit} disabled={running || !coordinator || !registryAddress}>Refresh onchain ownership audit</button>
      {audit && <dl className="governance-audit"><div><dt>Registry owner</dt><dd>{audit.registryOwner}</dd></div><div><dt>Coordinator owner</dt><dd>{audit.coordinatorOwner}</dd></div><div><dt>Bootstrap attestor</dt><dd>{audit.bootstrapAttestor ? "STILL AUTHORIZED" : "REVOKED"}</dd></div><div><dt>Bootstrap operator</dt><dd>{audit.bootstrapOperator ? "STILL AUTHORIZED" : "REVOKED"}</dd></div></dl>}
      <small>Multisig {multisig ? short(multisig) : "not deployed"} · Quorum {quorum ? short(quorum) : "not deployed"}</small>
    </div>
    <small className="proof-note">{notice}</small>
  </div>;
}
