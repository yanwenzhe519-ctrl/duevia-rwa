import fs from "node:fs";
import solc from "solc";

const file = "DueviaAssetAssuranceRegistry.sol";
const contractName = "DueviaAssetAssuranceRegistry";
const source = fs.readFileSync(`contracts/${file}`, "utf8");
const input = {
  language: "Solidity",
  sources: { [file]: { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));

const artifact = output.contracts[file][contractName];
if (!artifact?.evm?.bytecode?.object) throw new Error("Registry compilation produced no bytecode");

const text = `import type { Hex } from "viem";\n\n// Generated from contracts/${file}.\nexport const dueviaRegistryAbi = ${JSON.stringify(artifact.abi)} as const;\nexport const dueviaRegistryBytecode = "0x${artifact.evm.bytecode.object}" as Hex;\n`;
fs.writeFileSync("lib/duevia-registry-artifact.ts", text);
