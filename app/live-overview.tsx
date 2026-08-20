"use client";

import { useEffect, useState } from "react";

type Operations = {
  status?: string;
  chainId?: number;
  cadenceMinutes?: number;
  latestRunAt?: string;
  latestRunAgeMinutes?: number;
  persistent?: boolean;
  automaticBroadcastEnabled?: boolean;
  failover?: { status?: string };
};

type Agent = { mode?: string; model?: string; readiness?: string };

function readModel(value?: string) {
  if (!value) return "Workers AI";
  return value.split("/").pop() || "Workers AI";
}

function readAiStatus(readiness?: string) {
  if (!readiness) return "--";
  if (readiness === "READY") return "READY";
  if (readiness === "CONFIGURED_UNVERIFIED") return "CONFIGURED";
  return "REVIEW";
}

function readAiDetail(agent: Agent | null) {
  if (!agent) return "awaiting health";
  if (agent.readiness === "READY") return "model-grounded · verified";
  if (agent.readiness === "CONFIGURED_UNVERIFIED") return "configured · verification pending";
  return "review required · fail-closed";
}

function formatSync(value?: string) {
  if (!value) return "Awaiting first sync";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveOverview() {
  const [operations, setOperations] = useState<Operations | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [operationsResponse, agentResponse] = await Promise.all([
          fetch("/api/operations/health", { cache: "no-store" }),
          fetch("/api/agent/health", { cache: "no-store" }),
        ]);
        const nextOperations = operationsResponse.ok ? await operationsResponse.json() as Operations : null;
        const nextAgent = agentResponse.ok ? await agentResponse.json() as Agent : null;
        if (!cancelled) {
          setOperations(nextOperations);
          setAgent(nextAgent);
          setError(!nextOperations || !nextAgent);
          setUpdatedAt(new Date().toISOString());
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const status = error ? "DEGRADED" : operations ? "OPERATIONAL" : "CONNECTING";
  const statusClass = status === "OPERATIONAL" ? "is-operational" : status === "DEGRADED" ? "is-degraded" : "is-connecting";

  return <div className="live-overview" aria-label="Live Duevia system overview">
    <div className="live-overview-head"><span>LIVE SYSTEM OVERVIEW</span><b className={statusClass}><i />{status}</b></div>
    <div className="live-overview-title"><div><span>CONTINUITY CONTROL PLANE</span><strong>Duevia / X Layer</strong><small>{operations?.chainId ? `X Layer Testnet · chain ${operations.chainId}` : "X Layer Testnet"}</small></div><div className="live-overview-mark">D</div></div>
    <div className="live-overview-metrics">
      <div><span>Runtime persistence</span><strong>{operations?.persistent ? "D1" : "--"}</strong><small>{operations?.persistent ? "persistent evidence" : "awaiting health"}</small></div>
      <div><span>Keeper cadence</span><strong>{operations?.cadenceMinutes ? `${operations.cadenceMinutes}m` : "--"}</strong><small>scheduled scan</small></div>
      <div><span>AI runtime</span><strong>{readAiStatus(agent?.readiness)}</strong><small>{readModel(agent?.model)} · {readAiDetail(agent)}</small></div>
    </div>
    <div className="live-overview-rows"><div><span>Failover policy</span><b>{operations?.failover?.status || "CHECKING"}</b></div><div><span>Execution boundary</span><b>{operations?.automaticBroadcastEnabled ? "AUTHORIZED" : "HUMAN APPROVAL"}</b></div><div><span>Latest sync</span><b>{formatSync(operations?.latestRunAt)}</b></div></div>
    <div className="live-overview-foot"><span>{updatedAt ? `Auto-refresh · ${formatSync(updatedAt)}` : "Connecting to public runtime"}</span><a href="/proof">View evidence <span>↗</span></a></div>
  </div>;
}
