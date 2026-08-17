import { spawnSync } from "node:child_process";
import path from "node:path";

const platformPackage = process.platform === "win32"
  ? "forge-win32-amd64"
  : process.platform === "darwin"
    ? (process.arch === "arm64" ? "forge-darwin-arm64" : "forge-darwin-amd64")
    : (process.arch === "arm64" ? "forge-linux-arm64" : "forge-linux-amd64");
const binaryName = process.platform === "win32" ? "forge.exe" : "forge";
const binary = path.join(process.cwd(), "node_modules", "@foundry-rs", platformPackage, "bin", binaryName);
const result = spawnSync(binary, ["test", ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) throw new Error(`Foundry binary is unavailable at ${binary}: ${result.error.message}`);
process.exit(result.status ?? 1);
