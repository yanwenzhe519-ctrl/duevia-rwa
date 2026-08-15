// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDueviaEligibilityGuard {
    function requireEligible(bytes32 attestationId) external view;
}

/// @title Duevia Receivables Pool
/// @notice Minimal X Layer pool proving that eligibility controls real value-bearing deposits.
contract DueviaReceivablesPool {
    IDueviaEligibilityGuard public immutable guard;
    mapping(address => uint256) public balances;
    uint256 public totalDeposited;

    event DepositAccepted(address indexed account, bytes32 indexed attestationId, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    error ZeroAmount();
    error InsufficientBalance();
    error TransferFailed();

    constructor(address guardAddress) {
        guard = IDueviaEligibilityGuard(guardAddress);
    }

    function deposit(bytes32 attestationId) external payable {
        if (msg.value == 0) revert ZeroAmount();
        guard.requireEligible(attestationId);
        balances[msg.sender] += msg.value;
        totalDeposited += msg.value;
        emit DepositAccepted(msg.sender, attestationId, msg.value);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        totalDeposited -= amount;
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }
}
