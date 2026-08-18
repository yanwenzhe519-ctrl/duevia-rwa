export const dueviaRelease = "duevia-rwa/2026.08.18";

export const dueviaProject = {
  chainId: 1952,
  projectId: "0x5c939e6382044f5bf74e865f5b497f038c90ec9dc65b96b36bd8b5d434ab3477",
  multisigOwner: "0x11d698C4b9771BEc4C3DF7F27D07d2D9bEC7BB3c",
} as const;

export const dueviaContracts = [
  { key: "registry", label: "Asset Assurance Registry", address: "0x2f3Ca46E20b5fe5587Ccb3CCC9ba63F82713FC2C", deploymentTransaction: "0x887a08f0eb2b0033bb1b7b6935eb972af32c6f3230813cc38fecf28bc187e545" },
  { key: "coordinator", label: "Recovery Coordinator", address: "0x87d000cF49Ca890106BB259257bd5d1b186605cA", deploymentTransaction: "0xd59401ebb65f66127d915d5970bc1f61706a3ffff8e1613c7dc57b8303a51136" },
  { key: "guard", label: "Dual Eligibility Guard", address: "0x8Efe42614646c21d512b8B15418c53791d83B0fE", deploymentTransaction: "0x6761c2e638e67f5bdf9f4df68e551692f942ccaea7d50b06818d8bd0f3741664" },
  { key: "pool", label: "Continuity Pool", address: "0xCEC40281682fFd279d8414b828C40d7811F737c4", deploymentTransaction: "0xa06d391a79f7ca022291c79480c955fbce5e2703533dd176d47e8a4aadc0fd49" },
  { key: "multisig", label: "Recovery Multisig", address: "0x11d698C4b9771BEc4C3DF7F27D07d2D9bEC7BB3c", deploymentTransaction: "0xe04642bd81110ca5307319f41cf73cc2bd67234d221561ce8ed271bfc198fe1b" },
  { key: "quorum", label: "Observer Quorum", address: "0x444870d8776a95f403DD6A9A011e86433A9FB643", deploymentTransaction: "0xfbcfeeb908b7441cfb4aac06a3bfb46c0b23099948ed2aceb60ee19b8ecbb152" },
] as const;

export const dueviaGovernanceTransactions = [
  { label: "Registry global ownership accepted", transaction: "0x65dfe81cc05bfadf548613385958b66ccb6000b31d7a918db0d1ea9c10e5634e" },
  { label: "Coordinator global ownership accepted", transaction: "0x6f5f65a9a27c1a59c7593da7c9e078a7cae14a60ed07abefe099693a9eecfbf5" },
  { label: "Registry project ownership accepted", transaction: "0xfa3703c7cc24e2a7d065fb29d6c19d2b5a01bc1bcc05d798053c29e8997f1ec5" },
  { label: "Coordinator project ownership accepted", transaction: "0x8ef87178846800ce9e57e355d13bc34b6995e4a9193fb2c2df501f981b04f6ad" },
  { label: "Observer Quorum project operator approval 1", transaction: "0xe0552cc25609e394db1757ea2edc45d5a3c668e3e5a3c59c8528363711d555fd" },
  { label: "Observer Quorum project operator approval 2", transaction: "0xdb1f8fab32dd967292da1a95a9d19857fab5c2b250c0496e96bd57fe696fcaf6" },
  { label: "Observer Quorum project operator executed", transaction: "0x560ab3d2857782868c7d4b4830b84eabd5b579a9793ae31f770ea6d2996d4742" },
  { label: "Recovery Multisig project operator approval 1", transaction: "0x474f00bc57a41c3f06710c00237f5f0eb907350c92baabe5cf59e1cda8d3f67b" },
  { label: "Recovery Multisig project operator approval 2", transaction: "0x12e244e981834cacfb88bfb5be3f6bd59e4c517d7430885c5c11668fecfb24c8" },
  { label: "Recovery Multisig project operator executed", transaction: "0x8556881a70f954472b8cebe4c3e2494f4c778280ab4005b0f3d098c426da1bee" },
] as const;

export const legacyRehearsalTransactions = [
  { label: "Legacy SUSPENDED attestation", transaction: "0x653d0fb6ae23d2b6425444cab13d551a48b6e44a27e9772ef0a9c2c29099ba82" },
  { label: "Legacy VERIFIED attestation", transaction: "0x28765800663e1dfa48ecbb9a09ead38673a0c9316e0e8faefc2862d66e1bfc55" },
  { label: "Legacy guarded 1 wei deposit", transaction: "0xe525d1b7fa4dc315a0b014c6f5e1d0e8a2fd66ce2bff0b346e37047c403f9a77" },
] as const;

export const dueviaFinalRehearsal = {
  projectId: dueviaProject.projectId,
  incidentId: "0x3ea7e7e6a9c80f8a80ce63f0075affc0e8cfaf84c267d652514def87888ebd33",
  recoveryRoot: "0x58318a3032ad1c918464dfeb9bbea47b16fd27d4b36087b0659781fa9cbf6b17",
  suspendedAttestationId: "0xe56c5591731c52acd3aa906d710ab7443b9d46b4cd2dd27ba87272eb9408bfa4",
  verifiedAttestationId: "0xe044c7158ed81f1c9b395e47c0f8361885ef01b61d1fa8f14c18a1d1adcee30e",
  poolBlocked: true,
  transactions: [
    { label: "Final SUSPENDED registry attestation", transaction: "0xf604e74c71eaff1f5a6db121a440f4b24f321d964fff127ff09bdac2dcf4b0bc", blockNumber: 38591749 },
    { label: "Final Coordinator incident opened", transaction: "0x33e87afc3210cad68c21a835a9a725482c8f2fed3469fd20098e6a6306a84ab3", blockNumber: 38591754 },
    { label: "Final recovery root recorded", transaction: "0x2b5c82a58ef8d16f24f6ebdecad6eff39cd6dc8cbd51fbbdec45b5ecca3c31bb", blockNumber: 38591883 },
    { label: "Final successor proposed", transaction: "0x8d592420429f26368e4a751bf764eb6ad3304700c64fd1b82ebcd251b71f1390", blockNumber: 38591888 },
    { label: "Final VERIFIED registry attestation", transaction: "0xb146b64c33f1754473467212a7b36859aef9e066fe042928b1d6ced3f501de7e", blockNumber: 38591892 },
    { label: "Final successor verified", transaction: "0x389145183a53f8eff5ca5a71c97e75bd10eff80d36b4ba67aaeb3454d1f1d8e8", blockNumber: 38591896 },
    { label: "Final VERIFIED 1 wei deposit accepted", transaction: "0xbc35fcf72a84353db732c9f1fe85c39fdb2be34d6bdead6ef924288c2dfb0363", blockNumber: 38591900 },
  ],
} as const;
