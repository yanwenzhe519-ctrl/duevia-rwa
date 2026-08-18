"use client";

import { useEffect, useState } from "react";

type ReleaseEvidence = {
  release?: {
    name?: string;
    gitCommit?: string;
    deployedAt?: string | null;
    workerVersion?: string | null;
  };
};

const short = (value?: string | null) => value && value !== "unknown" ? value.slice(0, 12) : "unavailable";

export default function ReleaseProof() {
  const [evidence, setEvidence] = useState<ReleaseEvidence | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch("/api/evidence", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Evidence unavailable")))
      .then((value) => { setEvidence(value); setStatus("ready"); })
      .catch(() => { setEvidence({}); setStatus("error"); });
  }, []);

  const release = evidence?.release;
  const pending = status === "loading";
  const unavailable = status === "error";
  const valueOrStatus = (value?: string | null) => value ? value : pending ? "Reading live API…" : "Unavailable";
  return <dl className="release-proof" aria-label="Live deployment provenance">
    <div><dt>Release</dt><dd>{valueOrStatus(release?.name || "Duevia RWA live build")}</dd></div>
    <div><dt>Git commit</dt><dd>{short(release?.gitCommit) === "unavailable" ? (pending ? "Reading live API…" : unavailable ? "Unavailable" : "Pending") : short(release?.gitCommit)}</dd></div>
    <div><dt>Worker version</dt><dd>{short(release?.workerVersion) === "unavailable" ? (pending ? "Reading live API…" : unavailable ? "Unavailable" : "Pending") : short(release?.workerVersion)}</dd></div>
    <div><dt>Deployed</dt><dd>{release?.deployedAt ? new Date(release.deployedAt).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : pending ? "Reading live API…" : "Unavailable"}</dd></div>
  </dl>;
}
