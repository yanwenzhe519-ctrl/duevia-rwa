import fs from "node:fs";
import solc from "solc";

const source = fs.readFileSync("contracts/DueviaReceivablesPool.sol", "utf8");
const input = { language: "Solidity", sources: { "DueviaReceivablesPool.sol": { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
const artifact = output.contracts["DueviaReceivablesPool.sol"].DueviaReceivablesPool;
if (!artifact?.evm?.bytecode?.object) throw new Error("Pool compilation produced no bytecode");
const text = `// Generated from contracts/DueviaReceivablesPool.sol with solc 0.8.30.\nexport const dueviaPoolAbi = ${JSON.stringify(artifact.abi)} as const;\nexport const dueviaPoolBytecode = "0x${artifact.evm.bytecode.object}" as const;\n`;
fs.writeFileSync("lib/duevia-pool-artifact.ts", text);
