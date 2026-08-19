import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const contracts = [
  ["DueviaRwaRegistry.sol", "DueviaRwaRegistry", "dueviaRwaRegistry"],
  ["DueviaCheckpointRegistry.sol", "DueviaCheckpointRegistry", "dueviaCheckpointRegistry"],
  ["DueviaIncidentStateMachine.sol", "DueviaIncidentStateMachine", "dueviaIncidentStateMachine"],
  ["DueviaRwaVault.sol", "DueviaRwaVault", "dueviaRwaVault"],
  ["DueviaRecoveryAdapterV2.sol", "DueviaRecoveryAdapterV2", "dueviaRecoveryAdapterV2"],
];

for (const [file, contractName, prefix] of contracts) {
  const input = {
    language: "Solidity",
    sources: { [file]: { content: fs.readFileSync(`contracts/${file}`, "utf8") } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: (importPath) => {
    const localPath = path.resolve("contracts", importPath.replace(/^\.\//, ""));
    const resolved = fs.existsSync(localPath) ? localPath : path.resolve("node_modules", importPath);
    try { return { contents: fs.readFileSync(resolved, "utf8") }; } catch { return { error: `Import not found: ${importPath}` }; }
  } }));
  const errors = (output.errors || []).filter((entry) => entry.severity === "error");
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  const artifact = output.contracts[file][contractName];
  if (!artifact?.evm?.bytecode?.object) throw new Error(`${contractName} compilation produced no bytecode`);
  const filePrefix = prefix.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  fs.writeFileSync(`lib/${filePrefix}-artifact.ts`, `// Generated from contracts/${file}.\nexport const ${prefix}Abi = ${JSON.stringify(artifact.abi)} as const;\nexport const ${prefix}Bytecode = "0x${artifact.evm.bytecode.object}" as const;\n`);
}
