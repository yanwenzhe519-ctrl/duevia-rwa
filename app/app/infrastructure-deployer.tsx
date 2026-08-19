"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, encodeDeployData, encodeFunctionData, getCreate2Address, http, isAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { dueviaRegistryAbi } from "@/lib/duevia-registry-artifact";
import { dueviaRecoveryAbi, dueviaRecoveryBytecode } from "@/lib/duevia-recovery-artifact";
import { dueviaContinuityGuardAbi, dueviaContinuityGuardBytecode } from "@/lib/duevia-continuity-guard-artifact";
import { dueviaContinuityPoolAbi, dueviaContinuityPoolBytecode } from "@/lib/duevia-continuity-pool-artifact";
import { dueviaObserverQuorumAbi, dueviaObserverQuorumBytecode } from "@/lib/duevia-observer-quorum-artifact";
import { dueviaRecoveryMultisigAbi, dueviaRecoveryMultisigBytecode } from "@/lib/duevia-recovery-multisig-artifact";
import { dueviaRwaRegistryAbi, dueviaRwaRegistryBytecode } from "@/lib/duevia-rwa-registry-artifact";
import { dueviaCheckpointRegistryAbi, dueviaCheckpointRegistryBytecode } from "@/lib/duevia-checkpoint-registry-artifact";
import { dueviaIncidentStateMachineAbi, dueviaIncidentStateMachineBytecode } from "@/lib/duevia-incident-state-machine-artifact";
import { dueviaRwaVaultAbi, dueviaRwaVaultBytecode } from "@/lib/duevia-rwa-vault-artifact";
import { dueviaRecoveryAdapterV2Abi, dueviaRecoveryAdapterV2Bytecode } from "@/lib/duevia-recovery-adapter-v2-artifact";

type EthereumProvider = { request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown> };
declare global { interface Window { ethereum?: EthereumProvider } }

const chain = { id: 1952, name: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } }, blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" } } } as const;
const factory = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address;
const projectWallet = "0x05667de34ad47bafe8a8b976c19809cadf7719d2";
const governanceWallets = [projectWallet, "0xcf4f92fbe73fb01de45cdc4e370126963c851b51", "0x0bfc04d69f2c407e1571a3582314cd66058cd29e"];
const observerWallets = ["0x4b2b20213de88a66c2d2ba458733b8e599c93bad", "0x0cd03c1760b5b1c0ca0f065dc931ad3e86b730dd", "0x6431727d667d9dddea1df49e4627b7403f791f0a"];
const verifiedTakeoverMultisig = "0x11d698C4b9771BEc4C3DF7F27D07d2D9bEC7BB3c" as Address;
const verifiedTakeoverContracts = {
  rwaRegistry: "0xaeCA0FEe07Debea353eB0728EdD1e9D917a94297",
  checkpointRegistry: "0x9fB26d32750f387c75F9577135a6E274730759D2",
  incidentStateMachine: "0xBb9dfb771248594A365cabe0114cf362d68279a7",
  rwaVault: "0x00344E2e44AFf7cF7429738E99Fd056a099A077F",
  recoveryAdapterV2: "0x3d901880b9416ad7b00569C7b0B67b8e8008d6Af",
} as const;
const takeoverRolePlan = [
  ["RWA Registry", "rwaRegistry", "DEFAULT_ADMIN_ROLE"], ["RWA Registry", "rwaRegistry", "REGISTRAR_ROLE"],
  ["Checkpoint Registry", "checkpointRegistry", "DEFAULT_ADMIN_ROLE"], ["Checkpoint Registry", "checkpointRegistry", "CHECKPOINTER_ROLE"],
  ["Incident State Machine", "incidentStateMachine", "DEFAULT_ADMIN_ROLE"], ["Incident State Machine", "incidentStateMachine", "OPERATOR_ROLE"], ["Incident State Machine", "incidentStateMachine", "GOVERNANCE_ROLE"], ["Incident State Machine", "incidentStateMachine", "EXECUTOR_ROLE"],
  ["RWA Vault", "rwaVault", "DEFAULT_ADMIN_ROLE"], ["RWA Vault", "rwaVault", "SERVICER_ROLE"],
  ["Recovery Adapter V2", "recoveryAdapterV2", "DEFAULT_ADMIN_ROLE"], ["Recovery Adapter V2", "recoveryAdapterV2", "EXECUTOR_ROLE"],
] as const;
const demoProjectId = keccak256(stringToHex("duevia:xlayer-demo-rwa:v3"));
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const publicClient = createPublicClient({ chain, transport: http("https://testrpc.xlayer.tech") });

type DeploymentResult = { address: Address; transactionHash?: Hex; blockNumber?: bigint };
type GovernanceAudit = {
  registryOwner: string;
  coordinatorOwner: string;
  registryProjectOwner: string;
  coordinatorProjectOwner: string;
  bootstrapAttestor: boolean;
  bootstrapOperator: boolean;
  observerQuorumProjectOperator: boolean;
  recoveryMultisigProjectOperator: boolean;
};

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

async function ensureProjectConfiguration(account: Address, registryAddress: Address, coordinatorAddress: Address) {
  const registryExists = await publicClient.readContract({ address: registryAddress, abi: dueviaRegistryAbi, functionName: "projectExists", args: [demoProjectId] });
  const coordinatorExists = await publicClient.readContract({ address: coordinatorAddress, abi: dueviaRecoveryAbi, functionName: "projectExists", args: [demoProjectId] });
  const current: Record<string, unknown> = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}");
  current.projectId = demoProjectId;
  if (!registryExists) {
    const result = await write(account, registryAddress, dueviaRegistryAbi, "registerProject", [demoProjectId, account]);
    current.registryProjectRegistration = { transactionHash: result.hash, blockNumber: result.blockNumber.toString() };
  }
  if (!coordinatorExists) {
    const result = await write(account, coordinatorAddress, dueviaRecoveryAbi, "registerProject", [demoProjectId, account]);
    current.coordinatorProjectRegistration = { transactionHash: result.hash, blockNumber: result.blockNumber.toString() };
  }
  const registryAttestor = await publicClient.readContract({ address: registryAddress, abi: dueviaRegistryAbi, functionName: "projectAttestors", args: [demoProjectId, account] });
  if (!registryAttestor) {
    const result = await write(account, registryAddress, dueviaRegistryAbi, "setProjectAttestor", [demoProjectId, account, true]);
    current.registryProjectAttestor = { transactionHash: result.hash, blockNumber: result.blockNumber.toString() };
  }
  const coordinatorOperator = await publicClient.readContract({ address: coordinatorAddress, abi: dueviaRecoveryAbi, functionName: "projectOperators", args: [demoProjectId, account] });
  if (!coordinatorOperator) {
    const result = await write(account, coordinatorAddress, dueviaRecoveryAbi, "setProjectOperator", [demoProjectId, account, true]);
    current.coordinatorProjectOperator = { transactionHash: result.hash, blockNumber: result.blockNumber.toString() };
  }
  localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
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
  const [rwaRegistry, setRwaRegistry] = useState("");
  const [checkpointRegistry, setCheckpointRegistry] = useState("");
  const [incidentMachine, setIncidentMachine] = useState("");
  const [rwaVault, setRwaVault] = useState("");
  const [recoveryAdapter, setRecoveryAdapter] = useState("");
  const [hardenedVault, setHardenedVault] = useState("");
  const [hardenedAdapter, setHardenedAdapter] = useState("");
  const [governance, setGovernance] = useState(governanceWallets);
  const [observers, setObservers] = useState(observerWallets);
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
    setCoordinator(localStorage.getItem("duevia-recovery-coordinator-v3") || "");
    setContinuityGuard(localStorage.getItem("duevia-continuity-guard-v3") || "");
    setContinuityPool(localStorage.getItem("duevia-continuity-pool-v3") || "");
    setMultisig(localStorage.getItem("duevia-recovery-multisig-v3") || "");
    setQuorum(localStorage.getItem("duevia-observer-quorum-v3") || "");
    setRwaRegistry(localStorage.getItem("duevia-rwa-registry-v1") || "");
    setCheckpointRegistry(localStorage.getItem("duevia-checkpoint-registry-v1") || "");
    setIncidentMachine(localStorage.getItem("duevia-incident-machine-v1") || "");
    setRwaVault(localStorage.getItem("duevia-rwa-vault-v1") || "");
    setRecoveryAdapter(localStorage.getItem("duevia-recovery-adapter-v2-v1") || "");
    setHardenedVault(localStorage.getItem("duevia-rwa-vault-hardened-v2") || "");
    setHardenedAdapter(localStorage.getItem("duevia-recovery-adapter-v2-hardened") || "");
    const saved = JSON.parse(localStorage.getItem("duevia-governance-addresses") || "null") as unknown;
    if (Array.isArray(saved) && saved.length === 3 && saved.every((value) => typeof value === "string")) setGovernance(saved);
    const savedObservers = JSON.parse(localStorage.getItem("duevia-observer-addresses") || "null") as unknown;
    if (Array.isArray(savedObservers) && savedObservers.length === 3 && savedObservers.every((value) => typeof value === "string")) setObservers(savedObservers);
    fetch("/api/evidence", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const evidence = await response.json() as { takeoverContracts?: Array<{ key: string; address: string }>; contracts?: Array<{ key: string; address: string }> };
      const takeover = new Map((evidence.takeoverContracts || []).map((item) => [item.key, item.address]));
      const governance = new Map((evidence.contracts || []).map((item) => [item.key, item.address]));
      const verified = { rwaRegistry: takeover.get("rwaRegistry"), checkpointRegistry: takeover.get("checkpointRegistry"), incidentMachine: takeover.get("incidentStateMachine"), rwaVault: takeover.get("rwaVault"), recoveryAdapter: takeover.get("recoveryAdapterV2") };
      if (verified.rwaRegistry) { setRwaRegistry(verified.rwaRegistry); localStorage.setItem("duevia-rwa-registry-v1", verified.rwaRegistry); }
      if (verified.checkpointRegistry) { setCheckpointRegistry(verified.checkpointRegistry); localStorage.setItem("duevia-checkpoint-registry-v1", verified.checkpointRegistry); }
      if (verified.incidentMachine) { setIncidentMachine(verified.incidentMachine); localStorage.setItem("duevia-incident-machine-v1", verified.incidentMachine); }
      if (verified.rwaVault) { setRwaVault(verified.rwaVault); localStorage.setItem("duevia-rwa-vault-v1", verified.rwaVault); }
      if (verified.recoveryAdapter) { setRecoveryAdapter(verified.recoveryAdapter); localStorage.setItem("duevia-recovery-adapter-v2-v1", verified.recoveryAdapter); }
      const verifiedMultisig = governance.get("multisig");
      const verifiedQuorum = governance.get("quorum");
      if (verifiedMultisig) { setMultisig(verifiedMultisig); localStorage.setItem("duevia-recovery-multisig-v3", verifiedMultisig); }
      if (verifiedQuorum) { setQuorum(verifiedQuorum); localStorage.setItem("duevia-observer-quorum-v3", verifiedQuorum); }
    }).catch(() => undefined);
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
        await ensureProjectConfiguration(account, registryAddress as Address, coordinator as Address);
        result = await create2Deploy(account, dueviaContinuityGuardBytecode, dueviaContinuityGuardAbi, [registryAddress as Address, coordinator as Address, 80, demoProjectId], "continuity-guard-v3");
      } else if (kind === "pool") {
        if (!isAddress(continuityGuard)) throw new Error("Deploy Dual Guard first");
        result = await create2Deploy(account, dueviaContinuityPoolBytecode, dueviaContinuityPoolAbi, [continuityGuard as Address], "continuity-pool");
      } else {
        if (!validConfiguration) throw new Error("Enter three governance addresses and three non-overlapping testnet observer identities, then confirm the separation");
        localStorage.setItem("duevia-governance-addresses", JSON.stringify(governance));
        localStorage.setItem("duevia-observer-addresses", JSON.stringify(observers));
        result = kind === "multisig"
          ? await create2Deploy(account, dueviaRecoveryMultisigBytecode, dueviaRecoveryMultisigAbi, [governance as Address[], 2], "recovery-multisig")
          : await create2Deploy(account, dueviaObserverQuorumBytecode, dueviaObserverQuorumAbi, [observers as Address[], 2], "observer-quorum");
      }
      saveResult(kind, result);
      if (kind === "coordinator") { setCoordinator(result.address); localStorage.setItem("duevia-recovery-coordinator-v3", result.address); }
      if (kind === "guard") { setContinuityGuard(result.address); localStorage.setItem("duevia-continuity-guard-v3", result.address); }
      if (kind === "pool") { setContinuityPool(result.address); localStorage.setItem("duevia-continuity-pool-v3", result.address); }
      if (kind === "multisig") { setMultisig(result.address); localStorage.setItem("duevia-recovery-multisig-v3", result.address); }
      if (kind === "quorum") { setQuorum(result.address); localStorage.setItem("duevia-observer-quorum-v3", result.address); }
      setNotice(`${kind} ready at ${result.address}${result.transactionHash ? ` · tx ${result.transactionHash}` : " · existing deployment verified"}${kind === "guard" ? ` · project ${demoProjectId}` : ""}`);
    } catch (error) { setNotice(`${kind} failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const deployTakeover = async (kind: "rwaRegistry" | "checkpointRegistry" | "incidentMachine" | "rwaVault" | "recoveryAdapter") => {
    setRunning(true);
    try {
      const account = await activeAccount();
      let result: DeploymentResult;
      if (kind === "rwaRegistry") result = await create2Deploy(account, dueviaRwaRegistryBytecode, dueviaRwaRegistryAbi, [account], "rwa-registry-v1");
      else if (kind === "checkpointRegistry") result = await create2Deploy(account, dueviaCheckpointRegistryBytecode, dueviaCheckpointRegistryAbi, [account], "checkpoint-registry-v1");
      else if (kind === "incidentMachine") result = await create2Deploy(account, dueviaIncidentStateMachineBytecode, dueviaIncidentStateMachineAbi, [account], "incident-machine-v1");
      else if (kind === "rwaVault") result = await create2Deploy(account, dueviaRwaVaultBytecode, dueviaRwaVaultAbi, [account], "rwa-vault-v1");
      else {
        if (!isAddress(rwaVault)) throw new Error("Deploy the RWA Vault first");
        result = await create2Deploy(account, dueviaRecoveryAdapterV2Bytecode, dueviaRecoveryAdapterV2Abi, [account, rwaVault as Address], "recovery-adapter-v2-v1");
      }
      saveResult(kind, result);
      const setters: Record<string, (value: string) => void> = { rwaRegistry: setRwaRegistry, checkpointRegistry: setCheckpointRegistry, incidentMachine: setIncidentMachine, rwaVault: setRwaVault, recoveryAdapter: setRecoveryAdapter };
      const keys: Record<string, string> = { rwaRegistry: "duevia-rwa-registry-v1", checkpointRegistry: "duevia-checkpoint-registry-v1", incidentMachine: "duevia-incident-machine-v1", rwaVault: "duevia-rwa-vault-v1", recoveryAdapter: "duevia-recovery-adapter-v2-v1" };
      setters[kind](result.address);
      localStorage.setItem(keys[kind], result.address);
      setNotice(`${kind} ready at ${result.address}${result.transactionHash ? ` · tx ${result.transactionHash}` : " · existing deployment verified"}`);
    } catch (error) { setNotice(`${kind} failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const deployHardened = async (kind: "vault" | "adapter") => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!isAddress(verifiedTakeoverMultisig)) throw new Error("Verified Recovery Multisig is not configured");
      let result: DeploymentResult;
      if (kind === "vault") {
        result = await create2Deploy(account, dueviaRwaVaultBytecode, dueviaRwaVaultAbi, [verifiedTakeoverMultisig], "rwa-vault-hardened-v2");
      } else {
        if (!isAddress(hardenedVault)) throw new Error("Deploy the hardened Vault first");
        result = await create2Deploy(account, dueviaRecoveryAdapterV2Bytecode, dueviaRecoveryAdapterV2Abi, [verifiedTakeoverMultisig, hardenedVault as Address], "recovery-adapter-v2-hardened");
      }
      const current = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}") as Record<string, unknown>;
      const replacement = (current.hardenedReplacement || {}) as Record<string, unknown>;
      replacement[kind === "vault" ? "vault" : "adapter"] = { address: result.address, transactionHash: result.transactionHash || null, blockNumber: result.blockNumber?.toString() || null, admin: verifiedTakeoverMultisig, replaces: kind === "vault" ? verifiedTakeoverContracts.rwaVault : verifiedTakeoverContracts.recoveryAdapterV2 };
      current.hardenedReplacement = replacement;
      localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
      if (kind === "vault") {
        setHardenedVault(result.address);
        localStorage.setItem("duevia-rwa-vault-hardened-v2", result.address);
      } else {
        setHardenedAdapter(result.address);
        localStorage.setItem("duevia-recovery-adapter-v2-hardened", result.address);
      }
      setNotice(`Hardened ${kind} ready at ${result.address}${result.transactionHash ? ` · tx ${result.transactionHash}` : " · existing deployment verified"}. Old deployment remains unchanged.`);
    } catch (error) { setNotice(`Hardened ${kind} failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const hardenedAdapterRoleCall = () => {
    if (!isAddress(hardenedVault) || !isAddress(hardenedAdapter)) throw new Error("Deploy both hardened contracts first");
    const role = keccak256(stringToHex("ADAPTER_ROLE"));
    return { address: hardenedVault as Address, data: encodeFunctionData({ abi: dueviaRwaVaultAbi, functionName: "grantRole", args: [role, hardenedAdapter as Address] }) };
  };

  const approveHardenedAdapterRole = async () => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect one of the configured governance signers");
      if (!isAddress(multisig)) throw new Error("Verified Recovery Multisig is not loaded");
      const call = hardenedAdapterRoleCall();
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "approve", [call.address, BigInt(0), call.data]);
      setNotice(`Hardened Adapter role approval submitted · ${result.hash}. Switch to a second governance signer before execute.`);
    } catch (error) { setNotice(`Hardened Adapter role approval failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const executeHardenedAdapterRole = async () => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect one of the configured governance signers");
      if (!isAddress(multisig)) throw new Error("Verified Recovery Multisig is not loaded");
      const call = hardenedAdapterRoleCall();
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "execute", [call.address, BigInt(0), call.data]);
      const current = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}") as Record<string, unknown>;
      current.hardenedAdapterRoleGrant = { transactionHash: result.hash, blockNumber: result.blockNumber.toString(), vault: call.address, adapter: hardenedAdapter };
      localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
      setNotice(`Hardened Adapter ADAPTER_ROLE granted · ${result.hash}`);
    } catch (error) { setNotice(`Hardened Adapter role execution failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const authorizeRecoveryAdapter = async () => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!isAddress(rwaVault) || !isAddress(recoveryAdapter)) throw new Error("Deploy the RWA Vault and Recovery Adapter first");
      const adapterRole = keccak256(stringToHex("ADAPTER_ROLE"));
      const result = await write(account, rwaVault as Address, dueviaRwaVaultAbi, "grantRole", [adapterRole, recoveryAdapter as Address]);
      setNotice(`Recovery Adapter authorized on RWA Vault · ${result.hash}`);
    } catch (error) { setNotice(`Adapter authorization failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const grantTakeoverRole = async (contractKey: keyof typeof verifiedTakeoverContracts, roleName: string, label: string) => {
    setRunning(true);
    try {
      const account = await requireBootstrap();
      const address = verifiedTakeoverContracts[contractKey] as Address;
      const abi = contractKey === "rwaRegistry" ? dueviaRwaRegistryAbi : contractKey === "checkpointRegistry" ? dueviaCheckpointRegistryAbi : contractKey === "incidentStateMachine" ? dueviaIncidentStateMachineAbi : contractKey === "rwaVault" ? dueviaRwaVaultAbi : dueviaRecoveryAdapterV2Abi;
      const role = (roleName === "DEFAULT_ADMIN_ROLE" ? `0x${"0".repeat(64)}` : keccak256(stringToHex(roleName))) as Hex;
      const alreadyGranted = await publicClient.readContract({ address, abi, functionName: "hasRole", args: [role, verifiedTakeoverMultisig] });
      if (alreadyGranted) { setNotice(`${label} already granted to Recovery Multisig.`); return; }
      const result = await write(account, address, abi, "grantRole", [role, verifiedTakeoverMultisig]);
      setNotice(`${label} granted to Recovery Multisig · ${result.hash}`);
    } catch (error) { setNotice(`${label} failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const revokeTakeoverRoleData = (contractKey: keyof typeof verifiedTakeoverContracts, roleName: string) => {
    const address = verifiedTakeoverContracts[contractKey] as Address;
    const abi = contractKey === "rwaRegistry" ? dueviaRwaRegistryAbi : contractKey === "checkpointRegistry" ? dueviaCheckpointRegistryAbi : contractKey === "incidentStateMachine" ? dueviaIncidentStateMachineAbi : contractKey === "rwaVault" ? dueviaRwaVaultAbi : dueviaRecoveryAdapterV2Abi;
    const role = (roleName === "DEFAULT_ADMIN_ROLE" ? `0x${"0".repeat(64)}` : keccak256(stringToHex(roleName))) as Hex;
    return { address, abi, data: encodeFunctionData({ abi, functionName: "revokeRole", args: [role, projectWallet as Address] }) };
  };

  const approveTakeoverRoleRevoke = async (contractKey: keyof typeof verifiedTakeoverContracts, roleName: string, label: string) => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect one of the configured governance signers");
      if (!isAddress(multisig)) throw new Error("Verified Recovery Multisig is not loaded");
      const call = revokeTakeoverRoleData(contractKey, roleName);
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "approve", [call.address, BigInt(0), call.data]);
      setNotice(`${label} revoke approved by ${account} · ${result.hash}`);
    } catch (error) { setNotice(`${label} revoke approval failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const executeTakeoverRoleRevoke = async (contractKey: keyof typeof verifiedTakeoverContracts, roleName: string, label: string) => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect one of the configured governance signers");
      if (!isAddress(multisig)) throw new Error("Verified Recovery Multisig is not loaded");
      const call = revokeTakeoverRoleData(contractKey, roleName);
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "execute", [call.address, BigInt(0), call.data]);
      setNotice(`${label} revoke executed by Recovery Multisig · ${result.hash}`);
    } catch (error) { setNotice(`${label} revoke execution failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
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
  const projectTakeoverData = (target: "registry" | "coordinator") => encodeFunctionData({ abi: target === "registry" ? dueviaRegistryAbi : dueviaRecoveryAbi, functionName: "acceptProjectOwnership", args: [demoProjectId] });
  const projectOperatorGrantData = (operator: Address) => encodeFunctionData({ abi: dueviaRecoveryAbi, functionName: "setProjectOperator", args: [demoProjectId, operator, true] });

  const startProjectOwnershipTransfer = async () => {
    setRunning(true);
    try {
      const account = await requireBootstrap();
      if (!isAddress(registryAddress) || !isAddress(coordinator) || !isAddress(multisig)) throw new Error("Registry, Coordinator, and Multisig are required");
      const registryTx = await write(account, registryAddress as Address, dueviaRegistryAbi, "transferProjectOwnership", [demoProjectId, multisig as Address]);
      const coordinatorTx = await write(account, coordinator as Address, dueviaRecoveryAbi, "transferProjectOwnership", [demoProjectId, multisig as Address]);
      const current = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}") as Record<string, unknown>;
      current.projectOwnershipTransferStarted = { projectId: demoProjectId, registryTransactionHash: registryTx.hash, registryBlockNumber: registryTx.blockNumber.toString(), coordinatorTransactionHash: coordinatorTx.hash, coordinatorBlockNumber: coordinatorTx.blockNumber.toString() };
      localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
      setNotice(`Project ownership transfers started · Registry ${registryTx.hash} · Coordinator ${coordinatorTx.hash}`);
    } catch (error) { setNotice(`Project ownership transfer failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const approveProjectTakeover = async (target: "registry" | "coordinator") => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect a configured governance signer");
      const targetAddress = target === "registry" ? registryAddress : coordinator;
      if (!isAddress(multisig) || !isAddress(targetAddress)) throw new Error("Target deployment is missing");
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "approve", [targetAddress as Address, BigInt(0), projectTakeoverData(target)]);
      setNotice(`${target} project takeover approved by ${account} · ${result.hash}`);
    } catch (error) { setNotice(`Project approval failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const executeProjectTakeover = async (target: "registry" | "coordinator") => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect a configured governance signer");
      const targetAddress = target === "registry" ? registryAddress : coordinator;
      if (!isAddress(multisig) || !isAddress(targetAddress)) throw new Error("Target deployment is missing");
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "execute", [targetAddress as Address, BigInt(0), projectTakeoverData(target)]);
      const current = JSON.parse(localStorage.getItem("duevia-final-testnet-evidence") || "{}") as Record<string, unknown>;
      current[`${target}ProjectOwnershipAccepted`] = { projectId: demoProjectId, transactionHash: result.hash, blockNumber: result.blockNumber.toString() };
      localStorage.setItem("duevia-final-testnet-evidence", JSON.stringify(current));
      setNotice(`${target} project ownership accepted by Multisig · ${result.hash}`);
    } catch (error) { setNotice(`Project execution failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const approveProjectOperatorGrant = async (operator: string, label: string) => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!validGovernance || !governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect one of the configured governance signers");
      if (!isAddress(multisig) || !isAddress(coordinator) || !isAddress(operator)) throw new Error("Coordinator, Multisig, and operator address are required");
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "approve", [coordinator as Address, BigInt(0), projectOperatorGrantData(operator as Address)]);
      setNotice(`${label} operator grant approved by ${account} · ${result.hash}`);
    } catch (error) { setNotice(`${label} operator approval failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

  const executeProjectOperatorGrant = async (operator: string, label: string) => {
    setRunning(true);
    try {
      const account = await activeAccount();
      if (!validGovernance || !governance.some((value) => value.toLowerCase() === account.toLowerCase())) throw new Error("Connect one of the configured governance signers");
      if (!isAddress(multisig) || !isAddress(coordinator) || !isAddress(operator)) throw new Error("Coordinator, Multisig, and operator address are required");
      const result = await write(account, multisig as Address, dueviaRecoveryMultisigAbi, "execute", [coordinator as Address, BigInt(0), projectOperatorGrantData(operator as Address)]);
      setNotice(`${label} operator grant executed by Multisig · ${result.hash}`);
      await refreshAudit();
    } catch (error) { setNotice(`${label} operator execution failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
    finally { setRunning(false); }
  };

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
      const [registryOwner, coordinatorOwner, registryProjectOwner, coordinatorProjectOwner, bootstrapAttestor, bootstrapOperator, observerQuorumProjectOperator, recoveryMultisigProjectOperator] = await Promise.all([
        publicClient.readContract({ address: registryAddress as Address, abi: dueviaRegistryAbi, functionName: "owner" }),
        publicClient.readContract({ address: coordinator as Address, abi: dueviaRecoveryAbi, functionName: "owner" }),
        publicClient.readContract({ address: registryAddress as Address, abi: dueviaRegistryAbi, functionName: "projectOwners", args: [demoProjectId] }),
        publicClient.readContract({ address: coordinator as Address, abi: dueviaRecoveryAbi, functionName: "projectOwners", args: [demoProjectId] }),
        publicClient.readContract({ address: registryAddress as Address, abi: dueviaRegistryAbi, functionName: "authorizedAttestors", args: [projectWallet as Address] }),
        publicClient.readContract({ address: coordinator as Address, abi: dueviaRecoveryAbi, functionName: "operators", args: [projectWallet as Address] }),
        isAddress(quorum) ? publicClient.readContract({ address: coordinator as Address, abi: dueviaRecoveryAbi, functionName: "projectOperators", args: [demoProjectId, quorum as Address] }) : Promise.resolve(false),
        isAddress(multisig) ? publicClient.readContract({ address: coordinator as Address, abi: dueviaRecoveryAbi, functionName: "projectOperators", args: [demoProjectId, multisig as Address] }) : Promise.resolve(false),
      ]);
      setAudit({ registryOwner: String(registryOwner), coordinatorOwner: String(coordinatorOwner), registryProjectOwner: String(registryProjectOwner), coordinatorProjectOwner: String(coordinatorProjectOwner), bootstrapAttestor: Boolean(bootstrapAttestor), bootstrapOperator: Boolean(bootstrapOperator), observerQuorumProjectOperator: Boolean(observerQuorumProjectOperator), recoveryMultisigProjectOperator: Boolean(recoveryMultisigProjectOperator) });
      setNotice("Onchain governance state refreshed from X Layer Testnet.");
    } catch (error) { setNotice(`Audit failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 240)}`); }
  };

  return <div className="infrastructure-panel">
    <div className="panel-title"><div><span>X LAYER INFRASTRUCTURE</span><h3>Autonomous continuity runtime</h3></div><b>{runtime.operationsStatus === "HEALTHY" && runtime.model === "model-grounded" ? "LIVE" : "PARTIAL"}</b></div>
    <div className="monitor-grid"><div className="monitor-card"><span>Keeper operations</span><strong>{runtime.operationsStatus}</strong><small>{runtime.keeperRuns} runs · failover {runtime.failoverStatus}</small></div><div className="monitor-card"><span>AI investigator</span><strong>{runtime.model === "model-grounded" ? "MODEL LIVE" : "FALLBACK"}</strong><small>Structured output + verifier</small></div><div className="monitor-card"><span>Recovery state</span><strong>{runtime.incidents} incidents</strong><small>{runtime.capsules} capsules · {runtime.queuedActions} approval queue</small></div><div className="monitor-card"><span>Coordinator</span><strong>{coordinator ? short(coordinator) : "NOT DEPLOYED"}</strong><small>X Layer Testnet</small></div></div>
    <div className="governance-console">
      <div className="governance-heading"><span>RWA TAKEOVER CONTRACTS · TESTNET</span><strong>{[rwaRegistry, checkpointRegistry, incidentMachine, rwaVault, recoveryAdapter].filter(Boolean).length}/5 DEPLOYED</strong></div>
      <div className="continuity-buttons"><button type="button" className="upload-package" onClick={() => deployTakeover("rwaRegistry")} disabled={running || Boolean(rwaRegistry)}>Deploy RWA Registry</button><button type="button" className="upload-package" onClick={() => deployTakeover("checkpointRegistry")} disabled={running || Boolean(checkpointRegistry)}>Deploy Checkpoint Registry</button><button type="button" className="upload-package" onClick={() => deployTakeover("incidentMachine")} disabled={running || Boolean(incidentMachine)}>Deploy Incident State Machine</button></div>
      <div className="continuity-buttons"><button type="button" className="upload-package" onClick={() => deployTakeover("rwaVault")} disabled={running || Boolean(rwaVault)}>Deploy RWA Vault</button><button type="button" className="upload-package" onClick={() => deployTakeover("recoveryAdapter")} disabled={running || !rwaVault || Boolean(recoveryAdapter)}>Deploy Recovery Adapter V2</button><button type="button" className="anchor-button" onClick={authorizeRecoveryAdapter} disabled={running || !rwaVault || !recoveryAdapter}>Authorize Adapter on Vault</button></div>
      <small className="proof-note">New takeover contracts are immutable X Layer Testnet deployments. Addresses and transaction hashes are stored in this browser session until they are copied into the project registry.</small>
    </div>
    <div className="governance-console">
      <div className="governance-heading"><span>TAKEOVER GOVERNANCE HANDOFF · TESTNET</span><strong>GRANT BEFORE REVOKE</strong></div>
      <p className="proof-note">These controls use the RPC-verified takeover addresses and the already deployed Recovery Multisig. Each button sends one role grant; bootstrap permissions are not revoked automatically.</p>
      <div className="governance-actions takeover-role-actions">{takeoverRolePlan.map(([label, key, role]) => <div key={`${key}-${role}`}><span>{label} · {role}</span><button type="button" onClick={() => void grantTakeoverRole(key, role, `${label} ${role}`)} disabled={running}>Grant</button></div>)}</div>
    </div>
    <div className="governance-console">
      <div className="governance-heading"><span>HARDENED VAULT REPLACEMENT · TESTNET</span><strong>{hardenedVault && hardenedAdapter ? "2/2 READY" : hardenedVault ? "1/2 READY" : "0/2 READY"}</strong></div>
      <p className="proof-note">Deploys the replay-fixed Vault and a new Recovery Adapter V2 bound to it. The verified Recovery Multisig is the constructor admin. The old Vault and Adapter remain unchanged until this replacement is independently verified and migrated.</p>
      <div className="continuity-buttons"><button type="button" className="upload-package" onClick={() => void deployHardened("vault")} disabled={running || Boolean(hardenedVault)}>Deploy hardened Vault</button><button type="button" className="upload-package" onClick={() => void deployHardened("adapter")} disabled={running || !hardenedVault || Boolean(hardenedAdapter)}>Deploy hardened Recovery Adapter V2</button></div>
      <div className="governance-actions"><div><span>New Vault ADAPTER_ROLE → new Adapter</span><button type="button" onClick={() => void approveHardenedAdapterRole()} disabled={running || !isAddress(multisig) || !hardenedVault || !hardenedAdapter}>Approve</button><button type="button" onClick={() => void executeHardenedAdapterRole()} disabled={running || !isAddress(multisig) || !hardenedVault || !hardenedAdapter}>Execute after 2 approvals</button></div></div>
      <small className="proof-note">Hardened Vault: {hardenedVault ? short(hardenedVault) : "not deployed"} · Hardened Adapter: {hardenedAdapter ? short(hardenedAdapter) : "not deployed"}</small>
    </div>
    <div className="governance-console">
      <div className="governance-heading"><span>BOOTSTRAP ROLE REVOCATION · 2-OF-3</span><strong>APPROVE TWICE, THEN EXECUTE</strong></div>
      <p className="proof-note">Use two different configured governance signers. Revoke named roles first; revoke DEFAULT_ADMIN_ROLE last for each contract. No revoke is automatic.</p>
      <div className="governance-actions takeover-role-actions">{[...takeoverRolePlan].sort((a, b) => (a[2] === "DEFAULT_ADMIN_ROLE" ? 1 : 0) - (b[2] === "DEFAULT_ADMIN_ROLE" ? 1 : 0)).map(([label, key, role]) => <div key={`revoke-${key}-${role}`}><span>{label} · {role}</span><button type="button" onClick={() => void approveTakeoverRoleRevoke(key, role, `${label} ${role}`)} disabled={running || !isAddress(multisig)}>Approve revoke</button><button type="button" onClick={() => void executeTakeoverRoleRevoke(key, role, `${label} ${role}`)} disabled={running || !isAddress(multisig)}>Execute revoke</button></div>)}</div>
    </div>
    <div className="continuity-buttons"><button className="upload-package" type="button" onClick={() => deploy("coordinator")} disabled={running || Boolean(coordinator)}>Deploy Coordinator</button><button className="upload-package" type="button" onClick={() => deploy("guard")} disabled={running || !coordinator || !registryAddress || Boolean(continuityGuard)}>Deploy Dual Guard</button><button className="anchor-button" type="button" onClick={() => deploy("pool")} disabled={running || !continuityGuard || Boolean(continuityPool)}>Deploy Continuity Pool</button></div>
    <div className="governance-console">
      <div className="governance-heading"><span>2-OF-3 GOVERNANCE + OBSERVER QUORUM</span><strong>{validConfiguration ? "TESTNET CONFIGURATION VALID" : "SEPARATE THE TEST IDENTITIES"}</strong></div>
      <div className="governance-inputs">{governance.map((value, index) => <label key={index}><span>Governance signer {index + 1}</span><input value={value} onChange={(event) => setGovernance((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value.trim() : item))} spellCheck={false} /></label>)}</div>
      <div className="governance-inputs observer-inputs">{observers.map((value, index) => <label key={index}><span>Testnet observer identity {index + 1}</span><input value={value} onChange={(event) => setObservers((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value.trim() : item))} spellCheck={false} /></label>)}</div>
      <label className="governance-confirm"><input type="checkbox" checked={independenceConfirmed} onChange={(event) => setIndependenceConfirmed(event.target.checked)} /><span>I confirm governance and observer addresses do not overlap. These test identities are not represented as independent organizations.</span></label>
      <div className="continuity-buttons"><button type="button" className="upload-package" onClick={() => deploy("multisig")} disabled={running || !validConfiguration || Boolean(multisig)}>Deploy Recovery Multisig</button><button type="button" className="upload-package" onClick={() => deploy("quorum")} disabled={running || !validConfiguration || Boolean(quorum)}>Deploy Observer Quorum</button><button type="button" className="anchor-button" onClick={startOwnershipTransfer} disabled={running || !multisig || !coordinator || !registryAddress}>Start both ownership transfers</button></div>
      <div className="governance-actions"><div><span>Registry takeover</span><button type="button" onClick={() => approveTakeover("registry")} disabled={running || !multisig}>Approve</button><button type="button" onClick={() => executeTakeover("registry")} disabled={running || !multisig}>Execute after 2 approvals</button></div><div><span>Coordinator takeover</span><button type="button" onClick={() => approveTakeover("coordinator")} disabled={running || !multisig}>Approve</button><button type="button" onClick={() => executeTakeover("coordinator")} disabled={running || !multisig}>Execute after 2 approvals</button></div></div>
      <button type="button" className="anchor-button" onClick={startProjectOwnershipTransfer} disabled={running || !multisig || !coordinator || !registryAddress}>Start project-level ownership transfers</button>
      <div className="governance-actions"><div><span>Registry project takeover</span><button type="button" onClick={() => approveProjectTakeover("registry")} disabled={running || !multisig}>Approve</button><button type="button" onClick={() => executeProjectTakeover("registry")} disabled={running || !multisig}>Execute after 2 approvals</button></div><div><span>Coordinator project takeover</span><button type="button" onClick={() => approveProjectTakeover("coordinator")} disabled={running || !multisig}>Approve</button><button type="button" onClick={() => executeProjectTakeover("coordinator")} disabled={running || !multisig}>Execute after 2 approvals</button></div></div>
      <div className="governance-actions"><div><span>Observer Quorum project operator</span><button type="button" onClick={() => approveProjectOperatorGrant(quorum, "Observer Quorum")} disabled={running || !multisig || !coordinator || !isAddress(quorum)}>Approve</button><button type="button" onClick={() => executeProjectOperatorGrant(quorum, "Observer Quorum")} disabled={running || !multisig || !coordinator || !isAddress(quorum)}>Execute after 2 approvals</button></div><div><span>Recovery Multisig project operator</span><button type="button" onClick={() => approveProjectOperatorGrant(multisig, "Recovery Multisig")} disabled={running || !multisig || !coordinator || !isAddress(multisig)}>Approve</button><button type="button" onClick={() => executeProjectOperatorGrant(multisig, "Recovery Multisig")} disabled={running || !multisig || !coordinator || !isAddress(multisig)}>Execute after 2 approvals</button></div></div>
      <button type="button" className="audit-refresh" onClick={refreshAudit} disabled={running || !coordinator || !registryAddress}>Refresh onchain ownership audit</button>
      {audit && <dl className="governance-audit"><div><dt>Registry owner</dt><dd>{audit.registryOwner}</dd></div><div><dt>Coordinator owner</dt><dd>{audit.coordinatorOwner}</dd></div><div><dt>Registry project owner</dt><dd>{audit.registryProjectOwner}</dd></div><div><dt>Coordinator project owner</dt><dd>{audit.coordinatorProjectOwner}</dd></div><div><dt>Bootstrap attestor</dt><dd>{audit.bootstrapAttestor ? "STILL AUTHORIZED" : "REVOKED"}</dd></div><div><dt>Bootstrap operator</dt><dd>{audit.bootstrapOperator ? "STILL AUTHORIZED" : "REVOKED"}</dd></div><div><dt>Observer Quorum project operator</dt><dd className={audit.observerQuorumProjectOperator ? "audit-ok" : "audit-pending"}>{audit.observerQuorumProjectOperator ? "AUTHORIZED" : "NOT AUTHORIZED"}</dd></div><div><dt>Recovery Multisig project operator</dt><dd className={audit.recoveryMultisigProjectOperator ? "audit-ok" : "audit-pending"}>{audit.recoveryMultisigProjectOperator ? "AUTHORIZED" : "NOT AUTHORIZED"}</dd></div></dl>}
      <small>Multisig {multisig ? short(multisig) : "not deployed"} · Quorum {quorum ? short(quorum) : "not deployed"}</small>
    </div>
    <small className="proof-note">{notice}</small>
  </div>;
}
