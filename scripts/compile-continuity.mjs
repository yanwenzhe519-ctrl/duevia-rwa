import fs from "node:fs";
import solc from "solc";

const files = ["DueviaContinuityGuard.sol", "DueviaContinuityPool.sol"];
for (const file of files) {
  const source = fs.readFileSync(`contracts/${file}`, "utf8");
  const input = { language: "Solidity", sources: { [file]: { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((entry) => entry.severity === "error");
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  const contractName = file.replace(".sol", "");
  const artifact = output.contracts[file][contractName];
  if (!artifact?.evm?.bytecode?.object) throw new Error(`${contractName} compilation produced no bytecode`);
  const prefix = contractName === "DueviaContinuityGuard" ? "dueviaContinuityGuard" : "dueviaContinuityPool";
  fs.writeFileSync(`lib/${prefix.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-artifact.ts`, `// Generated from contracts/${file}.\nexport const ${prefix}Abi = ${JSON.stringify(artifact.abi)} as const;\nexport const ${prefix}Bytecode = "0x${artifact.evm.bytecode.object}" as const;\n`);
}

