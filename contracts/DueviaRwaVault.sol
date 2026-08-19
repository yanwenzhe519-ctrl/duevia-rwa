// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DueviaRwaVault is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant SERVICER_ROLE = keccak256("SERVICER_ROLE");
    bytes32 public constant ADAPTER_ROLE = keccak256("ADAPTER_ROLE");

    mapping(address => uint256) public principal;
    mapping(address => uint256) public accruedYield;
    mapping(address => uint256) public pendingRedemption;
    mapping(bytes32 => bool) public redemptionRequests;
    uint256 public totalPrincipal;
    uint256 public totalYield;

    event Deposit(address indexed account, uint256 amount);
    event Withdraw(address indexed account, uint256 amount);
    event YieldAccrued(address indexed account, uint256 amount);
    event RedemptionRequested(address indexed account, bytes32 indexed requestId, uint256 amount);
    event RedemptionSettled(address indexed account, bytes32 indexed requestId, uint256 amount);
    event NavUpdated(uint256 totalPrincipal, uint256 totalYield);

    error InvalidAmount();
    error InsufficientBalance();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SERVICER_ROLE, admin);
    }

    function deposit() external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        principal[msg.sender] += msg.value;
        totalPrincipal += msg.value;
        emit Deposit(msg.sender, msg.value);
        emit NavUpdated(totalPrincipal, totalYield);
    }

    function accrueYield(address account, uint256 amount) external onlyRole(SERVICER_ROLE) {
        if (amount == 0) revert InvalidAmount();
        accruedYield[account] += amount;
        totalYield += amount;
        emit YieldAccrued(account, amount);
        emit NavUpdated(totalPrincipal, totalYield);
    }

    function requestRedemption(bytes32 requestId, uint256 amount) external whenNotPaused {
        if (requestId == bytes32(0) || redemptionRequests[requestId] || amount == 0 || amount > principal[msg.sender] - pendingRedemption[msg.sender]) revert InvalidAmount();
        redemptionRequests[requestId] = true;
        pendingRedemption[msg.sender] += amount;
        emit RedemptionRequested(msg.sender, requestId, amount);
    }

    function settleRedemption(address account, bytes32 requestId, uint256 amount) external onlyRole(SERVICER_ROLE) nonReentrant {
        _settle(account, requestId, amount);
    }

    function adapterProtect() external onlyRole(ADAPTER_ROLE) { _pause(); }
    function adapterResume() external onlyRole(ADAPTER_ROLE) { _unpause(); }

    function adapterApply(address account, int256 principalDelta, int256 yieldDelta, int256 redemptionDelta) external onlyRole(ADAPTER_ROLE) {
        totalPrincipal = _applyDelta(totalPrincipal, principalDelta);
        totalYield = _applyDelta(totalYield, yieldDelta);
        principal[account] = _applyDelta(principal[account], principalDelta);
        accruedYield[account] = _applyDelta(accruedYield[account], yieldDelta);
        pendingRedemption[account] = _applyDelta(pendingRedemption[account], redemptionDelta);
        emit NavUpdated(totalPrincipal, totalYield);
    }

    function _settle(address account, bytes32 requestId, uint256 amount) private {
        if (amount == 0 || pendingRedemption[account] < amount || principal[account] < amount) revert InsufficientBalance();
        pendingRedemption[account] -= amount;
        principal[account] -= amount;
        totalPrincipal -= amount;
        (bool sent,) = account.call{value: amount}("");
        require(sent, "transfer failed");
        emit RedemptionSettled(account, requestId, amount);
        emit Withdraw(account, amount);
        emit NavUpdated(totalPrincipal, totalYield);
    }

    function _applyDelta(uint256 current, int256 delta) private pure returns (uint256) {
        if (delta >= 0) return current + uint256(delta);
        uint256 decrease = uint256(-delta);
        if (decrease > current) revert InsufficientBalance();
        return current - decrease;
    }
}
