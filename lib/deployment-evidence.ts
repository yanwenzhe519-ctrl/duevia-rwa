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
] as const;

export const legacyRehearsalTransactions = [
  { label: "Legacy SUSPENDED attestation", transaction: "0x653d0fb6ae23d2b6425444cab13d551a48b6e44a27e9772ef0a9c2c29099ba82" },
  { label: "Legacy VERIFIED attestation", transaction: "0x28765800663e1dfa48ecbb9a09ead38673a0c9316e0e8faefc2862d66e1bfc55" },
  { label: "Legacy guarded 1 wei deposit", transaction: "0xe525d1b7fa4dc315a0b014c6f5e1d0e8a2fd66ce2bff0b346e37047c403f9a77" },
] as const;
