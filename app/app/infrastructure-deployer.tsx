"use client";

import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, encodeDeployData, getCreate2Address, http, keccak256, stringToHex, type Address, type Hex } from "viem";
import { dueviaRecoveryAbi, dueviaRecoveryBytecode } from "@/lib/duevia-recovery-artifact";
import { dueviaContinuityGuardAbi, dueviaContinuityGuardBytecode } from "@/lib/duevia-continuity-guard-artifact";
import { dueviaContinuityPoolAbi, dueviaContinuityPoolBytecode } from "@/lib/duevia-continuity-pool-artifact";

type EthereumProvider = { request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown> };
declare global { interface Window { ethereum?: EthereumProvider } }

const chain = { id: 1952, name: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: ["https://testrpc.xlayer.tech"] } }, blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" } } } as const;
const factory = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address;
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

async function create2Deploy(wallet: string, bytecode: Hex, abi: readonly unknown[], args: readonly unknown[], label: string) {
  if (!window.ethereum) throw new Error("Wallet provider unavailable");
  const initCode = encodeDeployData({ abi, bytecode, args });
  const salt = keccak256(stringToHex(`duevia:${label}:v1:${wallet.toLowerCase()}`));
  const predicted = getCreate2Address({ from: factory, salt, bytecodeHash: keccak256(initCode) });
  const publicClient = createPublicClient({ chain, transport: http("https://testrpc.xlayer.tech") });
  const existing = await publicClient.getBytecode({ address: predicted });
  if (!existing || existing === "0x") {
    const client = createWalletClient({ chain, transport: custom(window.ethereum) });
    const hash = await client.sendTransaction({ account: wallet as Address, to: factory, data: `${salt}${initCode.slice(2)}` as Hex });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  const code = await publicClient.getBytecode({ address: predicted });
  if (!code || code === "0x") throw new Error(`${label} deployment produced no code`);
  return predicted;
}

export default function InfrastructureDeployer({ wallet, registryAddress }: { wallet: string; registryAddress: string }) {
  const [coordinator, setCoordinator] = useState("");
  const [continuityGuard, setContinuityGuard] = useState("");
  const [continuityPool, setContinuityPool] = useState("");
  const [notice, setNotice] = useState("Deploy the recovery state machine with the authorized project wallet.");
  const [running, setRunning] = useState(false);
  const [runtime, setRuntime] = useState({ persistent: false, keeperRuns: 0, model: "checking" });

  useEffect(() => {
    // Restore browser-owned deployment addresses after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCoordinator(localStorage.getItem("duevia-recovery-coordinator") || "");
    setContinuityGuard(localStorage.getItem("duevia-continuity-guard") || "");
    setContinuityPool(localStorage.getItem("duevia-continuity-pool") || "");
    Promise.all([fetch("/api/watchdog").then((response) => response.json()), fetch("/api/agent/health").then((response) => response.json())]).then(([watchdog, ai]) => setRuntime({ persistent: Boolean(watchdog.persistent), keeperRuns: Array.isArray(watchdog.keeperRuns) ? watchdog.keeperRuns.length : 0, model: ai.mode || "unavailable" })).catch(() => setRuntime({ persistent: false, keeperRuns: 0, model: "unavailable" }));
  }, []);

  const deployCoordinator = async () => {
    if (!wallet) return setNotice("Connect the authorized 0x0566 wallet first.");
    setRunning(true);
    try {
      const address = await create2Deploy(wallet, dueviaRecoveryBytecode, dueviaRecoveryAbi, [wallet as Address], "recovery-coordinator");
      localStorage.setItem("duevia-recovery-coordinator", address); setCoordinator(address); setNotice(`Recovery Coordinator ready at ${short(address)}.`);
    } catch (error) { setNotice(`Coordinator deployment failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 150)}`); } finally { setRunning(false); }
  };

  const deployGuard = async () => {
    if (!wallet || !registryAddress || !coordinator) return setNotice("Registry, Coordinator, and wallet are required.");
    setRunning(true);
    try {
      const address = await create2Deploy(wallet, dueviaContinuityGuardBytecode, dueviaContinuityGuardAbi, [registryAddress as Address, coordinator as Address, 80], "continuity-guard");
      localStorage.setItem("duevia-continuity-guard", address); setContinuityGuard(address); setNotice(`Continuity Guard ready at ${short(address)}.`);
    } catch (error) { setNotice(`Guard deployment failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 150)}`); } finally { setRunning(false); }
  };

  const deployPool = async () => {
    if (!wallet || !continuityGuard) return setNotice("Deploy the Continuity Guard first.");
    setRunning(true);
    try {
      const address = await create2Deploy(wallet, dueviaContinuityPoolBytecode, dueviaContinuityPoolAbi, [continuityGuard as Address], "continuity-pool");
      localStorage.setItem("duevia-continuity-pool", address); setContinuityPool(address); setNotice(`Continuity Pool ready at ${short(address)}.`);
    } catch (error) { setNotice(`Pool deployment failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 150)}`); } finally { setRunning(false); }
  };

  return <div className="infrastructure-panel"><div className="panel-title"><div><span>X LAYER INFRASTRUCTURE</span><h3>Autonomous continuity runtime</h3></div><b>{runtime.persistent && runtime.model === "model-grounded" ? "LIVE" : "PARTIAL"}</b></div><div className="monitor-grid"><div className="monitor-card"><span>Persistent Watchdog</span><strong>{runtime.persistent ? "D1 LIVE" : "OFFLINE"}</strong><small>{runtime.keeperRuns} recent keeper run(s)</small></div><div className="monitor-card"><span>AI investigator</span><strong>{runtime.model === "model-grounded" ? "MODEL LIVE" : "FALLBACK"}</strong><small>Grounded evidence analysis</small></div><div className="monitor-card"><span>Coordinator</span><strong>{coordinator ? short(coordinator) : "NOT DEPLOYED"}</strong><small>X Layer Testnet</small></div></div><div className="continuity-buttons"><button className="upload-package" type="button" onClick={deployCoordinator} disabled={running || Boolean(coordinator)}>{coordinator ? "Coordinator deployed" : "Deploy Coordinator"}</button><button className="upload-package" type="button" onClick={deployGuard} disabled={running || !coordinator || !registryAddress || Boolean(continuityGuard)}>{continuityGuard ? "Dual Guard deployed" : "Deploy Dual Guard"}</button><button className="anchor-button" type="button" onClick={deployPool} disabled={running || !continuityGuard || Boolean(continuityPool)}>{continuityPool ? "Continuity Pool deployed" : "Deploy Continuity Pool"}</button></div><small className="proof-note">{notice}</small></div>;
}
