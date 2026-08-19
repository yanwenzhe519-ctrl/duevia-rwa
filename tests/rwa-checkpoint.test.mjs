import assert from "node:assert/strict";
import test from "node:test";
import { buildRwaCheckpoint } from "../lib/rwa-checkpoint.mjs";

const account = "0x1111111111111111111111111111111111111111";
const contractAddress = "0x2222222222222222222222222222222222222222";
const event = (name, index, args, blockHash = "0xaaa") => ({ event: name, transactionHash: `0x${String(index + 1).padStart(64, "0")}`, logIndex: index, blockNumber: "10", blockHash, args: { account, ...args } });

test("builds account, yield, and redemption roots from confirmed events", () => {
  const checkpoint = buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 22, events: [event("Deposit", 0, { amount: "100" }), event("YieldAccrued", 1, { amount: "5" }), event("RedemptionRequested", 2, { requestId: "r1", amount: "20" })] });
  assert.equal(checkpoint.accounts[0].principal, "100");
  assert.equal(checkpoint.accounts[0].yield, "5");
  assert.equal(checkpoint.accounts[0].pendingRedemption, "20");
  assert.match(checkpoint.checkpointHash, /^0x[0-9a-f]{64}$/);
});

test("rejects reorg conflicts and duplicate redemption requests", () => {
  assert.throws(() => buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 22, events: [event("Deposit", 0, { amount: "1" }, "0xa"), event("Deposit", 1, { amount: "1" }, "0xb")] }), /reorganization/);
  assert.throws(() => buildRwaCheckpoint({ projectId: "sample", chainId: 1952, contractAddress, fromBlock: 10, toBlock: 10, confirmationBlock: 22, events: [event("RedemptionRequested", 0, { requestId: "r1", amount: "1" }), event("RedemptionRequested", 1, { requestId: "r1", amount: "1" })] }), /Duplicate redemption/);
});
