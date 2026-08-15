import fs from "node:fs";
import solc from "solc";

const source = fs.readFileSync("contracts/DueviaEligibilityGuard.sol", "utf8");
const input = { language: "Solidity", sources: { "DueviaEligibilityGuard.sol": { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const artifact = output.contracts["DueviaEligibilityGuard.sol"].DueviaEligibilityGuard;
if (!artifact?.evm?.bytecode?.object) throw new Error("Guard compilation produced no bytecode");
const text = `// Generated from contracts/DueviaEligibilityGuard.sol with solc 0.8.30.\nexport const dueviaGuardAbi = ${JSON.stringify(artifact.abi)} as const;\nexport const dueviaGuardBytecode = "0x${artifact.evm.bytecode.object}" as const;\n`;
fs.mkdirSync("lib", { recursive: true });
fs.writeFileSync("lib/duevia-guard-artifact.ts", text);
