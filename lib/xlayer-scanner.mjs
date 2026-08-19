import { decodeEventLog, keccak256, stringToHex } from "viem";

export const XLAYER_TESTNET_RPC = "https://testrpc.xlayer.tech";
export const DEFAULT_SCAN_DEPTH = 500n;
export const REQUIRED_CONFIRMATIONS = 12n;
const MAX_RPC_BLOCK_RANGE = 100n;
const MAX_SCAN_BLOCK_SPAN = 1_999n;

const monitoredEvents = [
  { name: "AttestationPublished", type: "event", inputs: [
    { indexed: true, name: "assetId", type: "bytes32" }, { indexed: true, name: "attestationId", type: "bytes32" },
    { indexed: false, name: "evidenceRoot", type: "bytes32" }, { indexed: false, name: "policyHash", type: "bytes32" },
    { indexed: false, name: "validUntil", type: "uint64" }, { indexed: false, name: "score", type: "uint8" },
    { indexed: false, name: "status", type: "uint8" }, { indexed: true, name: "attestor", type: "address" },
  ] },
  { name: "DepositAccepted", type: "event", inputs: [
    { indexed: true, name: "account", type: "address" }, { indexed: true, name: "attestationId", type: "bytes32" }, { indexed: false, name: "amount", type: "uint256" },
  ] },
  { name: "IncidentOpened", type: "event", inputs: [
    { indexed: true, name: "incidentId", type: "bytes32" }, { indexed: true, name: "poolId", type: "bytes32" }, { indexed: true, name: "servicerId", type: "bytes32" },
    { indexed: false, name: "previousAttestation", type: "bytes32" }, { indexed: false, name: "lastTrustedAt", type: "uint64" },
  ] },
  { name: "RecoveryRecorded", type: "event", inputs: [
    { indexed: true, name: "incidentId", type: "bytes32" }, { indexed: false, name: "recoveryRoot", type: "bytes32" }, { indexed: false, name: "state", type: "uint8" },
  ] },
  { name: "SuccessorVerified", type: "event", inputs: [
    { indexed: true, name: "incidentId", type: "bytes32" }, { indexed: true, name: "successorAttestation", type: "bytes32" }, { indexed: true, name: "successor", type: "address" },
  ] },
  { name: "Deposit", type: "event", inputs: [
    { indexed: true, name: "account", type: "address" }, { indexed: false, name: "amount", type: "uint256" },
  ] },
  { name: "Withdraw", type: "event", inputs: [
    { indexed: true, name: "account", type: "address" }, { indexed: false, name: "amount", type: "uint256" },
  ] },
  { name: "YieldAccrued", type: "event", inputs: [
    { indexed: true, name: "account", type: "address" }, { indexed: false, name: "amount", type: "uint256" },
  ] },
  { name: "RedemptionRequested", type: "event", inputs: [
    { indexed: true, name: "account", type: "address" }, { indexed: true, name: "requestId", type: "bytes32" }, { indexed: false, name: "amount", type: "uint256" },
  ] },
  { name: "RedemptionSettled", type: "event", inputs: [
    { indexed: true, name: "account", type: "address" }, { indexed: true, name: "requestId", type: "bytes32" }, { indexed: false, name: "amount", type: "uint256" },
  ] },
  { name: "NavUpdated", type: "event", inputs: [
    { indexed: false, name: "totalPrincipal", type: "uint256" }, { indexed: false, name: "totalYield", type: "uint256" },
  ] },
];

const eventSignature = (event) => `${event.name}(${event.inputs.map((input) => input.type).join(",")})`;
export const monitoredTopics = Object.fromEntries(monitoredEvents.map((event) => [keccak256(stringToHex(eventSignature(event))), event]));

function bigintJson(value) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function rpcCall(rpcUrl, method, params = [], fetchImpl = fetch) {
  const response = await fetchImpl(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!response.ok) throw new Error(`X Layer RPC ${method} failed with HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error) throw new Error(`X Layer RPC ${method} failed: ${payload.error.message || "unknown error"}`);
  return payload.result;
}

/** @param {{ rpcUrl?: string, fromBlock?: string | number | bigint, toBlock?: string | number | bigint, addresses?: string[], fetchImpl?: typeof fetch }} options */
export async function scanXLayer({ rpcUrl = XLAYER_TESTNET_RPC, fromBlock, toBlock, addresses = [], fetchImpl = fetch } = {}) {
  const latestHex = await rpcCall(rpcUrl, "eth_blockNumber", [], fetchImpl);
  const latest = BigInt(latestHex);
  const safeLatest = latest > REQUIRED_CONFIRMATIONS ? latest - REQUIRED_CONFIRMATIONS : 0n;
  const requestedEnd = toBlock == null ? safeLatest : BigInt(toBlock);
  const end = requestedEnd > safeLatest ? safeLatest : requestedEnd;
  const requestedStart = fromBlock == null ? (end > DEFAULT_SCAN_DEPTH ? end - DEFAULT_SCAN_DEPTH : 0n) : BigInt(fromBlock);
  const normalizedStart = requestedStart > end ? end : requestedStart;
  const start = end - normalizedStart > MAX_SCAN_BLOCK_SPAN ? end - MAX_SCAN_BLOCK_SPAN : normalizedStart;
  const logs = [];
  for (let chunkStart = start; chunkStart <= end; chunkStart += MAX_RPC_BLOCK_RANGE + 1n) {
    const chunkEnd = chunkStart + MAX_RPC_BLOCK_RANGE > end ? end : chunkStart + MAX_RPC_BLOCK_RANGE;
    for (const topic of Object.keys(monitoredTopics)) {
      const filter = { fromBlock: `0x${chunkStart.toString(16)}`, toBlock: `0x${chunkEnd.toString(16)}`, topics: [topic] };
      if (addresses.length) filter.address = addresses.map((address) => address.toLowerCase());
      logs.push(...await rpcCall(rpcUrl, "eth_getLogs", [filter], fetchImpl));
    }
  }
  const observations = logs.map((log) => {
    const event = monitoredTopics[log.topics[0]];
    let args = {};
    try { args = decodeEventLog({ abi: [event], data: log.data, topics: log.topics }).args; } catch { /* Keep the raw event if a future contract changes its payload. */ }
    return {
      observationId: `${log.transactionHash}:${Number(BigInt(log.logIndex))}`,
      source: "xlayer-rpc",
      chainId: 1952,
      event: event?.name || "Unknown",
      address: log.address.toLowerCase(),
      blockNumber: BigInt(log.blockNumber).toString(),
      blockHash: log.blockHash || null,
      logIndex: Number(BigInt(log.logIndex)),
      transactionHash: log.transactionHash,
      args: JSON.parse(JSON.stringify(args, (_key, value) => bigintJson(value))),
    };
  });
  const projects = [...new Set(observations.map((item) => item.address))].map((address) => ({ address, events: observations.filter((item) => item.address === address).length }));
  return { chainId: 1952, rpcUrl, fromBlock: start.toString(), toBlock: end.toString(), latestBlock: latest.toString(), confirmations: toBlock == null ? REQUIRED_CONFIRMATIONS.toString() : "caller-specified", skippedFromBlock: start > normalizedStart ? normalizedStart.toString() : null, observationCount: observations.length, projects, observations };
}
