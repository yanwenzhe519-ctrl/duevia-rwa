// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract DueviaCheckpointRegistry is AccessControl {
    bytes32 public constant CHECKPOINTER_ROLE = keccak256("CHECKPOINTER_ROLE");

    struct Checkpoint {
        uint64 chainId;
        address rwaContract;
        uint64 lastConfirmedBlock;
        bytes32 assetStateRoot;
        bytes32 accountBalanceRoot;
        bytes32 yieldStateRoot;
        bytes32 redemptionQueueRoot;
        bytes32 evidenceRoot;
        uint64 generatedAt;
        uint64 fromBlock;
        uint64 toBlock;
        uint64 nonce;
    }

    mapping(bytes32 => Checkpoint) private latest;
    mapping(bytes32 => mapping(uint64 => bytes32)) public checkpointHashes;

    event CheckpointCommitted(bytes32 indexed projectId, uint64 indexed nonce, uint64 indexed lastConfirmedBlock, bytes32 checkpointHash, bytes32 evidenceRoot);

    error InvalidCheckpoint();
    error InvalidNonce();

    constructor(address admin) {
        if (admin == address(0)) revert InvalidCheckpoint();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CHECKPOINTER_ROLE, admin);
    }

    function commit(bytes32 projectId, Checkpoint calldata checkpoint) external onlyRole(CHECKPOINTER_ROLE) returns (bytes32 checkpointHash) {
        Checkpoint memory previous = latest[projectId];
        if (projectId == bytes32(0) || checkpoint.chainId != block.chainid || checkpoint.rwaContract == address(0) || checkpoint.generatedAt > block.timestamp || checkpoint.fromBlock > checkpoint.toBlock || checkpoint.toBlock > checkpoint.lastConfirmedBlock) revert InvalidCheckpoint();
        if (checkpoint.nonce != previous.nonce + 1 || checkpoint.lastConfirmedBlock < previous.lastConfirmedBlock) revert InvalidNonce();
        checkpointHash = keccak256(abi.encode(checkpoint));
        if (checkpointHashes[projectId][checkpoint.nonce] != bytes32(0)) revert InvalidNonce();
        latest[projectId] = checkpoint;
        checkpointHashes[projectId][checkpoint.nonce] = checkpointHash;
        emit CheckpointCommitted(projectId, checkpoint.nonce, checkpoint.lastConfirmedBlock, checkpointHash, checkpoint.evidenceRoot);
    }

    function latestCheckpoint(bytes32 projectId) external view returns (Checkpoint memory) {
        return latest[projectId];
    }
}
