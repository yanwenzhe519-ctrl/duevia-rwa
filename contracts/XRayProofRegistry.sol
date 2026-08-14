// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title X-Ray RWA Proof Registry
/// @notice Stores only report fingerprints and state. Private evidence stays offchain.
contract XRayProofRegistry {
    enum Status { Review, Verified, Revoked }

    struct Proof {
        bytes32 assetId;
        bytes32 reportHash;
        bytes32 previousReportHash;
        uint8 score;
        Status status;
        uint64 issuedAt;
        address issuer;
    }

    address public immutable owner;
    mapping(bytes32 => Proof) private proofs;
    mapping(bytes32 => bool) public exists;

    event ProofAnchored(bytes32 indexed reportId, bytes32 indexed assetId, bytes32 reportHash, uint8 score, Status status, address indexed issuer);
    event ProofRevoked(bytes32 indexed reportId, bytes32 indexed reportHash, address indexed revoker);

    error NotOwner();
    error AlreadyAnchored();
    error UnknownProof();
    error InvalidScore();

    constructor() { owner = msg.sender; }

    function anchorProof(
        bytes32 reportId,
        bytes32 assetId,
        bytes32 reportHash,
        bytes32 previousReportHash,
        uint8 score,
        Status status
    ) external {
        if (exists[reportId]) revert AlreadyAnchored();
        if (score > 100) revert InvalidScore();
        proofs[reportId] = Proof(assetId, reportHash, previousReportHash, score, status, uint64(block.timestamp), msg.sender);
        exists[reportId] = true;
        emit ProofAnchored(reportId, assetId, reportHash, score, status, msg.sender);
    }

    function revokeProof(bytes32 reportId) external {
        if (msg.sender != owner) revert NotOwner();
        if (!exists[reportId]) revert UnknownProof();
        proofs[reportId].status = Status.Revoked;
        emit ProofRevoked(reportId, proofs[reportId].reportHash, msg.sender);
    }

    function getProof(bytes32 reportId) external view returns (Proof memory) {
        if (!exists[reportId]) revert UnknownProof();
        return proofs[reportId];
    }
}
