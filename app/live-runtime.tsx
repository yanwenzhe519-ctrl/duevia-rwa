"use client";

import { useEffect, useState } from "react";

type Project = {
  pool_id?: string;
  servicer_id?: string;
  last_heartbeat_at?: string;
  last_state?: string;
  shadow_mode?: number;
};

type Watchdog = {
  incidents?: Array<{ state?: string; pool_id?: string; recovery_root?: string }>;
  keeperRuns?: Array<{ started_at?: string; finished_at?: string; status?: string; to_block?: string; observations?: number }>;
};

type Operations = {
  status?: string;
  chainId?: number;
  latestRunAt?: string;
  latestRunAgeMinutes?: number;
  failover?: { status?: string };
};

type Recovery = { capsules?: Array<{ recoveryRoot?: string; state?: string }> };
type Evidence = { generatedAt?: string; runtimeEvidenceAvailable?: boolean };
type Agent = { mode?: string; model?: string };

type RuntimeData = {
  project: Project | null;
  watchdog: Watchdog | null;
  operations: Operations | null;
  recovery: Recovery | null;
  evidence: Evidence | null;
  agent: Agent | null;
  updatedAt: string | null;
  error: boolean;
};

const emptyRuntime: RuntimeData = {
  project: null,
  watchdog: null,
  operations: null,
  recovery: null,
  evidence: null,
  agent: null,
  updatedAt: null,
  error: false,
};

function formatAge(value?: string) {
  if (!value) return "--";
  const hours = Math.max(0, (Date.now() - Date.parse(value)) / 3_600_000);
  return hours >= 24 ? `${Math.floor(hours)}h` : `${Math.max(1, Math.floor(hours * 60))}m`;
}

function formatTime(value?: string | null) {
  if (!value) return "Awaiting first sample";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stateLabel(value?: string) {
  if (!value) return "MONITORING";
  return value.replaceAll("_", " ");
}

async function readJson<T>(path: string) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

export function LiveRuntime({ variant = "hero" }: { variant?: "hero" | "execution" }) {
  const [runtime, setRuntime] = useState<RuntimeData>(emptyRuntime);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [projects, watchdog, operations, recovery, evidence, agent] = await Promise.all([
          readJson<{ projects?: Project[] }>("/api/watchdog/projects"),
          readJson<Watchdog>("/api/watchdog"),
          readJson<Operations>("/api/operations/health"),
          readJson<Recovery>("/api/recovery"),
          readJson<Evidence>("/api/evidence"),
          readJson<Agent>("/api/agent/health"),
        ]);
        if (cancelled) return;
        const project = projects.projects?.find((item) => item.pool_id === "DUEVIA-RCV-018") || projects.projects?.[0] || null;
        setRuntime({ project, watchdog, operations, recovery, evidence, agent, updatedAt: new Date().toISOString(), error: false });
      } catch {
        if (!cancelled) setRuntime((current) => ({ ...current, error: true }));
      }
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const incident = runtime.watchdog?.incidents?.[0];
  const latestRun = runtime.watchdog?.keeperRuns?.[0];
  const state = incident?.state || runtime.project?.last_state;
  const outage = Boolean(state && state !== "HEALTHY" && state !== "MONITORING");
  const capsuleCount = runtime.recovery?.capsules?.length || 0;
  const sourceLabel = runtime.project?.shadow_mode === 1 ? "SHADOW / TESTNET" : "SIGNED FEED / TESTNET";
  const modelLabel = runtime.agent?.model?.split("/").pop() || "Workers AI";
  const runtimeStatus = runtime.error ? "RECONNECTING" : runtime.updatedAt ? "LIVE" : "CONNECTING";
  const ageLabel = formatAge(runtime.project?.last_heartbeat_at);

  if (variant === "execution") {
    return <div className="report-mock continuity-mock live-execution" aria-label="Live Duevia recovery telemetry">
      <div className="mock-top"><span>{runtime.project?.pool_id || "POOL / RCV-018"}</span><b className={outage ? "is-alert" : ""}>{outage ? "SERVICER OFFLINE" : "MONITORING"}</b></div>
      <div className="mock-score"><strong>{ageLabel}</strong><span>since last signed<br />service heartbeat</span></div>
      <div className="mock-factors">
        <div><span>Pool action</span><b>{outage ? "PAUSED" : "WATCH"}</b></div>
        <div className="warn"><span>Recovery capsules</span><b>{capsuleCount || "--"}</b></div>
        <div><span>Keeper</span><b>{latestRun?.status?.toUpperCase() || "--"}</b></div>
        <div><span>Chain</span><b>X LAYER {runtime.operations?.chainId || 1952}</b></div>
      </div>
      <div className="mock-alert"><i>!</i><div><b>{outage ? "Primary servicer unavailable" : "Primary servicer monitored"}</b><span>{runtime.operations?.latestRunAt ? `Last scan ${formatTime(runtime.operations.latestRunAt)} · ${runtime.operations.latestRunAgeMinutes?.toFixed(0) || "--"}m ago` : "Waiting for the first public runtime sample"}</span></div></div>
      <div className="mock-chain"><span className="x-mini">D</span><div><b>{runtime.operations?.failover?.status || "FAILOVER"} · {sourceLabel}</b><small>{runtime.evidence?.runtimeEvidenceAvailable ? "D1 runtime evidence available" : "Evidence endpoint unavailable"}</small></div><em>{runtimeStatus} · {formatTime(runtime.updatedAt)}</em></div>
    </div>;
  }

  return <div className="hero-runtime live-runtime" aria-label="Live automatic AI recovery status">
    <div className="runtime-head"><span>LIVE RECOVERY TRACE</span><b><i className={runtimeStatus === "LIVE" ? "is-live" : ""} /> {runtimeStatus} / {sourceLabel}</b></div>
    <div className="runtime-meta"><span>{runtime.project?.pool_id || "DUEVIA-RCV-018"}</span><span>Updated {formatTime(runtime.updatedAt)}</span></div>
    <div className="runtime-alert"><strong>{outage ? "SERVICER OUTAGE DETECTED" : "SERVICER HEARTBEAT MONITORED"}</strong><span>{ageLabel} since the last signed heartbeat · {stateLabel(state)}</span></div>
    <div className="runtime-steps">
      <div className="runtime-step complete"><b>01</b><span><strong>Evidence collected</strong><small>{latestRun?.observations ?? 0} observations · block {latestRun?.to_block || "--"}</small></span><em>LIVE</em></div>
      <div className="runtime-step active"><b>02</b><span><strong>AI investigation ready</strong><small>{modelLabel} · independent verifier</small></span><em>{runtime.agent?.mode === "model-grounded" ? "MODEL" : "CHECK"}</em></div>
      <div className="runtime-step"><b>03</b><span><strong>Recovery plan {capsuleCount ? "available" : "pending"}</strong><small>{capsuleCount || "--"} public capsule records · human approval</small></span><em>{capsuleCount ? "READY" : "WAIT"}</em></div>
      <div className="runtime-step chain"><b>04</b><span><strong>X Layer state protected</strong><small>Chain {runtime.operations?.chainId || 1952} · failover {runtime.operations?.failover?.status || "CHECKING"}</small></span><em>ONCHAIN</em></div>
    </div>
    <div className="runtime-footer"><span role="status" aria-atomic="true">{runtime.error ? "Public runtime reconnecting" : `D1 + Cron + AI · refreshed ${formatTime(runtime.updatedAt)}`}</span><b>{outage ? "REVIEW REQUIRED" : "MONITORING"}</b></div>
  </div>;
}
