// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal onchain approval multisig for testnet recovery administration.
/// @dev Production deployments should use a reviewed Safe-compatible multisig.
contract DueviaRecoveryMultisig {
    mapping(address => bool) public isSigner;
    mapping(bytes32 => mapping(address => bool)) public approvedBy;
    mapping(bytes32 => uint256) public approvals;
    uint256 public immutable threshold;
    uint256 public nonce;

    error NotSigner();
    error InvalidConfiguration();
    error AlreadyApproved();
    error InsufficientApprovals();
    error ExecutionFailed();

    event Approved(bytes32 indexed transactionHash, address indexed signer, uint256 approvals);
    event Executed(bytes32 indexed transactionHash, address indexed target, uint256 value, uint256 nonce);

    constructor(address[] memory signers, uint256 threshold_) {
        if (threshold_ == 0 || threshold_ > signers.length) revert InvalidConfiguration();
        for (uint256 i; i < signers.length; i++) {
            if (signers[i] == address(0) || isSigner[signers[i]]) revert InvalidConfiguration();
            isSigner[signers[i]] = true;
        }
        threshold = threshold_;
    }

    function transactionHash(address target, uint256 value, bytes calldata data, uint256 nonce_) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), target, value, keccak256(data), nonce_));
    }

    function approve(address target, uint256 value, bytes calldata data) external returns (bytes32 txHash) {
        if (!isSigner[msg.sender]) revert NotSigner();
        txHash = transactionHash(target, value, data, nonce);
        if (approvedBy[txHash][msg.sender]) revert AlreadyApproved();
        approvedBy[txHash][msg.sender] = true;
        approvals[txHash] += 1;
        emit Approved(txHash, msg.sender, approvals[txHash]);
    }

    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (!isSigner[msg.sender]) revert NotSigner();
        bytes32 txHash = transactionHash(target, value, data, nonce);
        if (approvals[txHash] < threshold) revert InsufficientApprovals();
        uint256 executedNonce = nonce++;
        (bool ok, bytes memory response) = target.call{value: value}(data);
        if (!ok) revert ExecutionFailed();
        emit Executed(txHash, target, value, executedNonce);
        return response;
    }

    receive() external payable {}
}

