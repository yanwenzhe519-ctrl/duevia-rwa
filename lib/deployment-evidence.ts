export const dueviaRelease = "duevia-rwa/2026.08.20";

export const dueviaProject = {
  poolId: "DUEVIA-RCV-018",
  chainId: 1952,
  projectId: "0x5c939e6382044f5bf74e865f5b497f038c90ec9dc65b96b36bd8b5d434ab3477",
  multisigOwner: "0x11d698C4b9771BEc4C3DF7F27D07d2D9bEC7BB3c",
} as const;

export const dueviaTakeoverContracts = [
  { key: "rwaRegistry", label: "RWA Registry", address: "0xaeCA0FEe07Debea353eB0728EdD1e9D917a94297", deploymentTransaction: "0x0e0e641563022e0e954336433bc154dda531f54346d38ebd8ebc37da002dcc52", deploymentBlock: 38705557, bytecodeHash: "0xde28e065e28dbe7be82a3ffe205f85faabc42589ed7bf231c56bff03bdf717dc" },
  { key: "checkpointRegistry", label: "Checkpoint Registry", address: "0x9fB26d32750f387c75F9577135a6E274730759D2", deploymentTransaction: "0xa1fdfeebe9ecd171830e608aa1e28b1431c282b50ce14361fbc7369cfb63708b", deploymentBlock: 38705571, bytecodeHash: "0x3f2a6ebdefddcf4b13c426fe12af70970972f9ec2531d87e9e695c9a7c6a47e2" },
  { key: "incidentStateMachine", label: "Incident State Machine", address: "0xBb9dfb771248594A365cabe0114cf362d68279a7", deploymentTransaction: "0x39cab15d8fbc19900de93a85bde2d1308a72cea93dcc9960b27f3e175204cbe7", deploymentBlock: 38705583, bytecodeHash: "0x89cf28461730a27db5b185300a40c3ad61c6ab513766282fa308d75b9e1f39b4" },
  { key: "rwaVault", label: "RWA Vault", address: "0x00344E2e44AFf7cF7429738E99Fd056a099A077F", deploymentTransaction: "0xd2e6125197c1c1e918903e3b2143d23c955f1784c1d90645152916791a934df2", deploymentBlock: 38705607, bytecodeHash: "0xcb018f8373bfb7ea0b329f9e2845c4f267c63caaf65f2f9bea007fbab70a789d" },
  { key: "recoveryAdapterV2", label: "Recovery Adapter V2", address: "0x3d901880b9416ad7b00569C7b0B67b8e8008d6Af", deploymentTransaction: "0x10265dc4b640926ec50a28b8374099a8ae02ee592bb7e464d5b2d32dfc36b8bb", deploymentBlock: 38705619, bytecodeHash: "0xd527a7bfb19628a235a7b8d44d4b35f0283003d521feaba4e647ace22807d9c9" },
] as const;

export const dueviaTakeoverAuthorization = {
  transaction: "0x7ca1b72c541b4179dae61d793a423d8adc7103c6c99f54b0c900360b7ecebf71",
  blockNumber: 38705686,
  target: "0x00344E2e44AFf7cF7429738E99Fd056a099A077F",
  event: "RoleGranted",
  role: "0xdbeb657137b1822b3d5418bea6fd641226d964b4c3871ef23546db2622258871",
  roleLabel: "ADAPTER_ROLE",
  account: "0x3d901880b9416ad7b00569C7b0B67b8e8008d6Af",
  sender: "0x05667DE34Ad47bAFe8a8b976c19809cAdf7719D2",
} as const;

export const dueviaHardenedReplacement = {
  vault: {
    address: "0x437Fcbb7b474036FB534e0AFFafdB600D970d798",
    deploymentTransaction: "0x1a288a406265764ffe4ac34e25331e18c2da1b08c93b04b0b5734f9a56b6265f",
    deploymentBlock: 38719496,
    bytecodeHash: "0x92e6d9f79750dccf46590c02341cc9a032f265561e645f56430d30d052c30f24",
    admin: dueviaProject.multisigOwner,
    replaces: "0x00344E2e44AFf7cF7429738E99Fd056a099A077F",
  },
  adapter: {
    address: "0xeA1dbe4F4F8640214C1538210B494F5850537599",
    deploymentTransaction: "0x6c11c46ab355d5029f704f128af2ce53dd91c15bbaa85dad02f0e5febf983e06",
    deploymentBlock: 38719513,
    bytecodeHash: "0x6c62cd62aaa5ea1c98ae4de4113b232a532ea779792fb510a4c9b28022db0b12",
    admin: dueviaProject.multisigOwner,
    vault: "0x437Fcbb7b474036FB534e0AFFafdB600D970d798",
    replaces: "0x3d901880b9416ad7b00569C7b0B67b8e8008d6Af",
  },
  adapterRoleGranted: false,
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
