import fs from "node:fs";
import solc from "solc";

for (const contractName of ["DueviaRecoveryMultisig", "DueviaObserverQuorum"]) {
  const file = `${contractName}.sol`;
  const input = {
    language: "Solidity",
    sources: { [file]: { content: fs.readFileSync(`contracts/${file}`, "utf8") } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((entry) => entry.severity === "error");
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  const artifact = output.contracts[file][contractName];
  if (!artifact?.evm?.bytecode?.object) throw new Error(`${contractName} compilation produced no bytecode`);
  const prefix = contractName === "DueviaRecoveryMultisig" ? "dueviaRecoveryMultisig" : "dueviaObserverQuorum";
  fs.writeFileSync(`lib/${prefix.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-artifact.ts`, `// Generated from contracts/${file}.\nexport const ${prefix}Abi = ${JSON.stringify(artifact.abi)} as const;\nexport const ${prefix}Bytecode = "0x${artifact.evm.bytecode.object}" as const;\n`);
}
