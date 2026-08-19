import assert from "node:assert/strict";
import test from "node:test";
import { buildRwaCheckpoint } from "../lib/rwa-checkpoint.mjs";

const account = "0x1111111111111111111111111111111111111111";
const contractAddress = "0x2222222222222222222222222222222222222222";
const event = (name, index, args, blockHash = "0xaaa") => ({ event: name, transactionHash: `0x${String(index + 1).padStart(64, "0")}`, logIndex: index, blockNumber: "10", blockHash, args: { account, ...args } });

test("builds account, yield, and redemption roots from confirmed events", () => {
  const checkpoint = buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 22, confirmationDepth: 12, rpcUrl: "https://testrpc.xlayer.tech", events: [event("Deposit", 0, { amount: "100" }), event("YieldAccrued", 1, { amount: "5" }), event("RedemptionRequested", 2, { requestId: "r1", amount: "20" })] });
  assert.equal(checkpoint.accounts[0].principal, "100");
  assert.equal(checkpoint.accounts[0].yield, "5");
  assert.equal(checkpoint.accounts[0].pendingRedemption, "20");
  assert.equal(checkpoint.finalityStatus, "CONFIRMED");
  assert.equal(checkpoint.confirmationDepth, "12");
  assert.equal(checkpoint.rpcUrl, "https://testrpc.xlayer.tech");
  assert.match(checkpoint.checkpointHash, /^0x[0-9a-f]{64}$/);
});

test("rejects unknown finality metadata", () => {
  assert.throws(() => buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 10, finalityStatus: "UNKNOWN" }), /finality status/);
  assert.throws(() => buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 10, confirmationDepth: "twelve" }), /confirmation depth/);
});

test("rejects reorg conflicts and duplicate redemption requests", () => {
  assert.throws(() => buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 22, events: [event("Deposit", 0, { amount: "1" }, "0xa"), event("Deposit", 1, { amount: "1" }, "0xb")] }), /reorganization/);
  assert.throws(() => buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 22, events: [event("RedemptionRequested", 0, { requestId: "r1", amount: "1" }), event("RedemptionRequested", 1, { requestId: "r1", amount: "1" })] }), /Duplicate redemption/);
});

test("roots only confirmed events in the checkpoint range", () => {
  const checkpoint = buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 22, events: [event("Deposit", 0, { amount: "1" }), { ...event("Deposit", 1, { amount: "99" }), blockNumber: "11" }] });
  assert.equal(checkpoint.accounts[0].principal, "1");
  assert.equal(checkpoint.eventCount, 1);
  assert.equal(checkpoint.events, undefined);
});

test("settles a redemption requested in an earlier checkpoint", () => {
  const checkpoint = buildRwaCheckpoint({
    projectId: "sample", chainId: 1952, contractAddress, fromBlock: 11, toBlock: 11, confirmationBlock: 22,
    previousAccounts: { [account]: { principal: "100", yield: "0", pendingRedemption: "20" } },
    previousRedemptions: [{ requestId: "r1", account, amount: "20", status: "QUEUED" }],
    events: [{ ...event("RedemptionSettled", 0, { requestId: "r1", amount: "20" }), blockNumber: "11" }],
  });
  assert.equal(checkpoint.accounts[0].pendingRedemption, "0");
  assert.equal(checkpoint.redemptions[0].status, "SETTLED");
});
