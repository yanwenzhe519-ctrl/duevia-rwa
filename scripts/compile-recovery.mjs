import fs from "node:fs";
import solc from "solc";

const source = fs.readFileSync("contracts/DueviaRecoveryCoordinator.sol", "utf8");
const input = { language: "Solidity", sources: { "DueviaRecoveryCoordinator.sol": { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
const artifact = output.contracts["DueviaRecoveryCoordinator.sol"].DueviaRecoveryCoordinator;
if (!artifact?.evm?.bytecode?.object) throw new Error("Recovery coordinator compilation produced no bytecode");
fs.writeFileSync("lib/duevia-recovery-artifact.ts", `// Generated from contracts/DueviaRecoveryCoordinator.sol with solc 0.8.30.\nexport const dueviaRecoveryAbi = ${JSON.stringify(artifact.abi)} as const;\nexport const dueviaRecoveryBytecode = "0x${artifact.evm.bytecode.object}" as const;\n`);

