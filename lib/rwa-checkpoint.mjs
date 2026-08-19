import { createHash } from "node:crypto";

const canonical = (value) => value === null ? "null" : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const root = (value) => `0x${createHash("sha256").update(canonical(value)).digest("hex")}`;
const amount = (value) => {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text)) throw new Error("Event amount must be an unsigned integer.");
  return BigInt(text);
};

export function buildRwaCheckpoint({ projectId, chainId, contractAddress, fromBlock, toBlock, confirmationBlock, events = [], previousAccounts = {} }) {
  if (!projectId || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress || "") || Number(chainId) <= 0) throw new Error("Project, chain, and contract are required.");
  if (BigInt(toBlock) > BigInt(confirmationBlock) || BigInt(fromBlock) > BigInt(toBlock)) throw new Error("Checkpoint range is not confirmed.");
  const deduped = new Map();
  const blockHashes = new Map();
  for (const event of events) {
    const key = `${event.transactionHash}:${event.logIndex}`;
    if (!event.transactionHash || event.logIndex === undefined) throw new Error("Stable transactionHash and logIndex are required.");
    if (deduped.has(key) && canonical(deduped.get(key)) !== canonical(event)) throw new Error("Conflicting duplicate event.");
    deduped.set(key, event);
    if (event.blockHash) {
      const previousHash = blockHashes.get(String(event.blockNumber));
      if (previousHash && previousHash !== event.blockHash) throw new Error("Block reorganization detected.");
      blockHashes.set(String(event.blockNumber), event.blockHash);
    }
  }
  const accounts = Object.fromEntries(Object.entries(previousAccounts).map(([key, value]) => [key.toLowerCase(), { principal: String(value.principal || "0"), yield: String(value.yield || "0"), pendingRedemption: String(value.pendingRedemption || "0") }]));
  const redemptions = new Map();
  const ordered = [...deduped.values()].sort((a, b) => BigInt(a.blockNumber) === BigInt(b.blockNumber) ? Number(a.logIndex) - Number(b.logIndex) : BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : 1);
  for (const event of ordered) {
    if (BigInt(event.blockNumber) < BigInt(fromBlock) || BigInt(event.blockNumber) > BigInt(toBlock)) continue;
    const account = String(event.args?.account || "").toLowerCase();
    if (!["Deposit", "Withdraw", "YieldAccrued", "RedemptionRequested", "RedemptionSettled"].includes(event.event)) continue;
    if (!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Event account is invalid.");
    accounts[account] ||= { principal: "0", yield: "0", pendingRedemption: "0" };
    const value = amount(event.args?.amount);
    if (event.event === "Deposit") accounts[account].principal = (BigInt(accounts[account].principal) + value).toString();
    if (event.event === "Withdraw") accounts[account].principal = subtract(accounts[account].principal, value, "principal");
    if (event.event === "YieldAccrued") accounts[account].yield = (BigInt(accounts[account].yield) + value).toString();
    if (event.event === "RedemptionRequested") {
      const requestId = String(event.args?.requestId || "");
      if (!requestId || redemptions.has(requestId)) throw new Error("Duplicate redemption request.");
      redemptions.set(requestId, { requestId, account, amount: value.toString(), status: "QUEUED" });
      accounts[account].pendingRedemption = (BigInt(accounts[account].pendingRedemption) + value).toString();
    }
    if (event.event === "RedemptionSettled") {
      const requestId = String(event.args?.requestId || "");
      const request = redemptions.get(requestId);
      if (!request || request.status !== "QUEUED" || request.account !== account || request.amount !== value.toString()) throw new Error("Redemption settlement has no matching request.");
      request.status = "SETTLED";
      accounts[account].pendingRedemption = subtract(accounts[account].pendingRedemption, value, "pending redemption");
    }
  }
  const accountRows = Object.entries(accounts).sort(([a], [b]) => a.localeCompare(b)).map(([account, state]) => ({ account, ...state }));
  const redemptionRows = [...redemptions.values()].sort((a, b) => a.requestId.localeCompare(b.requestId));
  const eventRows = ordered.map((event) => ({ id: `${event.transactionHash}:${event.logIndex}`, event: event.event, blockNumber: String(event.blockNumber), blockHash: event.blockHash || null, args: event.args }));
  const checkpoint = { schema: "duevia.rwa-checkpoint/v1", projectId, chainId: Number(chainId), contractAddress: contractAddress.toLowerCase(), fromBlock: String(fromBlock), toBlock: String(toBlock), confirmationBlock: String(confirmationBlock), assetStateRoot: root(eventRows), accountBalanceRoot: root(accountRows.map(({ account, principal }) => ({ account, principal }))), yieldStateRoot: root(accountRows.map(({ account, yield: yieldAmount }) => ({ account, yield: yieldAmount }))), redemptionQueueRoot: root(redemptionRows), evidenceRoot: root(eventRows.map(({ id, blockHash }) => ({ id, blockHash }))), accounts: accountRows, redemptions: redemptionRows, eventCount: eventRows.length };
  return { ...checkpoint, checkpointHash: root(checkpoint) };
}

function subtract(current, decrease, label) {
  const result = BigInt(current) - decrease;
  if (result < 0n) throw new Error(`${label} cannot become negative.`);
  return result.toString();
}
