#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const command = args.shift() || "status";
const api = process.env.DUEVIA_API || "https://duevia.finance";
const configPath = join(process.cwd(), ".duevia", "config.json");
const readConfig = () => existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
const json = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const request = async (path, options = {}) => {
  const headers = { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(process.env.DUEVIA_ADMIN_TOKEN ? { Authorization: `Bearer ${process.env.DUEVIA_ADMIN_TOKEN}` } : {}) };
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${payload.error || "request failed"}`);
  return payload;
};

try {
  if (command === "init") {
    const projectId = args[0] || "sample-rwa";
    mkdirSync(join(process.cwd(), ".duevia"), { recursive: true });
    writeFileSync(configPath, JSON.stringify({ api, projectId, chainId: 1952, rpc: "https://testrpc.xlayer.tech", checkpointIntervalSeconds: 300 }, null, 2) + "\n");
    json({ ok: true, config: configPath, projectId, chainId: 1952 });
  } else if (command === "status") {
    const config = readConfig();
    json(await request(`/api/rwa/${encodeURIComponent(config.projectId || args[0] || "sample-rwa")}/status`));
  } else if (command === "checkpoint") {
    const config = readConfig();
    json(await request(`/api/rwa/${encodeURIComponent(config.projectId || args[0] || "sample-rwa")}/checkpoints`));
  } else if (command === "inspect-recovery") {
    const config = readConfig();
    json(await request(`/api/rwa/${encodeURIComponent(config.projectId || args[0] || "sample-rwa")}/decision-trace`));
  } else if (command === "simulate-outage") {
    const config = readConfig();
    const incidentId = args[1] || `cli-incident-${Date.now()}`;
    const evidence = args[0] ? JSON.parse(readFileSync(args[0], "utf8")) : null;
    if (!evidence) throw new Error("simulate-outage requires an evidence JSON file; it never invents account state.");
    json(await request(`/api/rwa/${encodeURIComponent(config.projectId || "sample-rwa")}/reconstruct`, { method: "POST", body: JSON.stringify({ incidentId, ...evidence }) }));
  } else if (command === "register") {
    const file = args[0];
    if (!file) throw new Error("register requires a project JSON file.");
    const project = JSON.parse(readFileSync(file, "utf8"));
    json(await request("/api/watchdog/projects", { method: "POST", body: JSON.stringify(project) }));
  } else {
    process.stdout.write("Usage: npx duevia init|register <project.json>|checkpoint [projectId]|simulate-outage <evidence.json>|inspect-recovery [projectId]|status [projectId]\n");
  }
} catch (error) {
  process.stderr.write(`Duevia CLI error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
