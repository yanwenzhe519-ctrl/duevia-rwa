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

  useEffect(() => {
    fetch("/api/evidence", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Evidence unavailable")))
      .then(setEvidence)
      .catch(() => setEvidence({}));
  }, []);

  const release = evidence?.release;
  return <dl className="release-proof" aria-label="Live deployment provenance">
    <div><dt>Release</dt><dd>{release?.name || "Loading live metadata"}</dd></div>
    <div><dt>Git commit</dt><dd>{short(release?.gitCommit)}</dd></div>
    <div><dt>Worker version</dt><dd>{short(release?.workerVersion)}</dd></div>
    <div><dt>Deployed</dt><dd>{release?.deployedAt ? new Date(release.deployedAt).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : "unavailable"}</dd></div>
  </dl>;
}
