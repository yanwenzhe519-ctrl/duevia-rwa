// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDueviaContinuityGuard {
    function requireOperational(bytes32 attestationId, bytes32 incidentId) external view;
}

/// @notice Reference value-bearing pool protected by asset and incident state.
contract DueviaContinuityPool {
    IDueviaContinuityGuard public immutable guard;
    mapping(address => uint256) public balances;
    uint256 public totalDeposited;

    error ZeroAmount();
    error InsufficientBalance();
    error TransferFailed();
    event DepositAccepted(address indexed account, bytes32 indexed attestationId, bytes32 indexed incidentId, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(address guardAddress) {
        guard = IDueviaContinuityGuard(guardAddress);
    }

    function deposit(bytes32 attestationId, bytes32 incidentId) external payable {
        if (msg.value == 0) revert ZeroAmount();
        guard.requireOperational(attestationId, incidentId);
        balances[msg.sender] += msg.value;
        totalDeposited += msg.value;
        emit DepositAccepted(msg.sender, attestationId, incidentId, msg.value);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0 || balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        totalDeposited -= amount;
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }
}

