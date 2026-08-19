// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DueviaRwaVault} from "./DueviaRwaVault.sol";

contract DueviaRecoveryAdapterV2 is AccessControl, ReentrancyGuard {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    struct AccountDiff {
        address account;
        int256 principalDelta;
        int256 yieldDelta;
        int256 redemptionDelta;
    }

    DueviaRwaVault public immutable vault;
    mapping(bytes32 => bool) public executedCapsules;
    mapping(bytes32 => bool) public protectedIncidents;

    event AdapterCheckpoint(bytes32 indexed checkpointHash, uint64 indexed blockNumber);
    event Protected(bytes32 indexed incidentId);
    event RecoveryExecuted(bytes32 indexed capsuleId, bytes32 indexed stateDiffHash, uint256 accountCount);
    event RuntimeResumed(bytes32 indexed incidentId);

    error InvalidAction();
    error Replay();

    constructor(address admin, DueviaRwaVault vault_) {
        if (admin == address(0) || address(vault_) == address(0)) revert InvalidAction();
        vault = vault_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
    }

    function checkpoint() external view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(vault), vault.totalPrincipal(), vault.totalYield(), block.number));
    }

    function protect(bytes32 incidentId) external onlyRole(EXECUTOR_ROLE) {
        if (incidentId == bytes32(0) || protectedIncidents[incidentId]) revert Replay();
        protectedIncidents[incidentId] = true;
        vault.adapterProtect();
        emit Protected(incidentId);
    }

    function applyRecovery(bytes32 capsuleId, AccountDiff[] calldata stateDiff) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        if (capsuleId == bytes32(0) || executedCapsules[capsuleId] || stateDiff.length == 0) revert Replay();
        executedCapsules[capsuleId] = true;
        for (uint256 i; i < stateDiff.length; ++i) {
            if (stateDiff[i].account == address(0)) revert InvalidAction();
            vault.adapterApply(stateDiff[i].account, stateDiff[i].principalDelta, stateDiff[i].yieldDelta, stateDiff[i].redemptionDelta);
        }
        emit RecoveryExecuted(capsuleId, keccak256(abi.encode(stateDiff)), stateDiff.length);
    }

    function resume(bytes32 incidentId) external onlyRole(EXECUTOR_ROLE) {
        if (!protectedIncidents[incidentId]) revert InvalidAction();
        vault.adapterResume();
        emit RuntimeResumed(incidentId);
    }
}
