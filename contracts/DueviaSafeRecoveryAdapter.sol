// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Narrow interface documenting the Safe execution boundary.
/// @dev The adapter never implements signature collection or custody.
interface ISafeLike {
    function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes calldata signatures) external payable returns (bool success);
}

/// @notice Safe boundary for project recovery actions.
/// @dev A reviewed Safe must call this adapter. It does not hold funds and each action is one-shot.
contract DueviaSafeRecoveryAdapter {
    address public immutable safe;
    bytes32 public immutable projectId;
    mapping(bytes32 => bool) public executed;

    error OnlySafe();
    error InvalidAction();
    error AlreadyExecuted();
    error CallFailed();

    event RecoveryActionExecuted(bytes32 indexed actionId, bytes32 indexed incidentId, bytes32 indexed recoveryRoot, address target, uint256 value);

    constructor(address safe_, bytes32 projectId_) {
        if (safe_ == address(0) || projectId_ == bytes32(0)) revert InvalidAction();
        safe = safe_;
        projectId = projectId_;
    }

    function actionId(bytes32 incidentId, bytes32 recoveryRoot, address target, uint256 value, bytes calldata data) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), projectId, incidentId, recoveryRoot, target, value, keccak256(data)));
    }

    function executeRecovery(bytes32 incidentId, bytes32 recoveryRoot, address target, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != safe) revert OnlySafe();
        if (incidentId == bytes32(0) || recoveryRoot == bytes32(0) || target == address(0) || data.length < 4) revert InvalidAction();
        bytes32 id = actionId(incidentId, recoveryRoot, target, value, data);
        if (executed[id]) revert AlreadyExecuted();
        executed[id] = true;
        (bool ok, bytes memory response) = target.call{value: value}(data);
        if (!ok) revert CallFailed();
        emit RecoveryActionExecuted(id, incidentId, recoveryRoot, target, value);
        return response;
    }

    receive() external payable { revert InvalidAction(); }
}
