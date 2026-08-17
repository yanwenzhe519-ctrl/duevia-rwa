// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Duevia Asset Assurance Registry
/// @notice Stores privacy-preserving asset assurance states. Raw evidence remains offchain.
contract DueviaAssetAssuranceRegistry {
    enum Status { Pending, Verified, Review, Stale, Suspended, Revoked }

    struct Attestation {
        bytes32 evidenceRoot;
        bytes32 policyHash;
        bytes32 previousAttestation;
        uint64 issuedAt;
        uint64 validUntil;
        uint8 score;
        Status status;
        address attestor;
    }

    address public owner;
    address public pendingOwner;
    mapping(address => bool) public authorizedAttestors;
    mapping(bytes32 => address) public projectOwners;
    mapping(bytes32 => address) public pendingProjectOwners;
    mapping(bytes32 => mapping(address => bool)) public projectAttestors;
    mapping(bytes32 => bool) public projectExists;
    mapping(bytes32 => bytes32) public attestationProject;
    mapping(bytes32 => Attestation) private attestations;
    mapping(bytes32 => bool) public exists;

    event AttestorAuthorizationChanged(address indexed attestor, bool authorized);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AttestationPublished(bytes32 indexed assetId, bytes32 indexed attestationId, bytes32 evidenceRoot, bytes32 policyHash, uint64 validUntil, uint8 score, Status status, address indexed attestor);
    event AttestationStatusChanged(bytes32 indexed assetId, bytes32 indexed attestationId, Status status, address indexed updater);
    event ProjectRegistered(bytes32 indexed projectId, address indexed projectOwner);
    event ProjectOwnerTransferStarted(bytes32 indexed projectId, address indexed currentOwner, address indexed pendingOwner);
    event ProjectOwnerTransferred(bytes32 indexed projectId, address indexed previousOwner, address indexed newOwner);
    event ProjectAttestorAuthorizationChanged(bytes32 indexed projectId, address indexed attestor, bool authorized);

    error NotOwner();
    error NotPendingOwner();
    error NotAuthorizedAttestor();
    error AlreadyPublished();
    error UnknownAttestation();
    error InvalidScore();
    error InvalidValidityWindow();
    error InvalidProject();
    error NotProjectOwner();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert NotOwner();
        owner = initialOwner;
        authorizedAttestors[initialOwner] = true;
        emit AttestorAuthorizationChanged(initialOwner, true);
    }

    modifier onlyProjectOwner(bytes32 projectId) {
        if (!projectExists[projectId] || projectOwners[projectId] != msg.sender) revert NotProjectOwner();
        _;
    }

    function registerProject(bytes32 projectId, address projectOwner) external {
        if (msg.sender != owner) revert NotOwner();
        if (projectId == bytes32(0) || projectOwner == address(0) || projectExists[projectId]) revert InvalidProject();
        projectExists[projectId] = true;
        projectOwners[projectId] = projectOwner;
        emit ProjectRegistered(projectId, projectOwner);
    }

    function transferProjectOwnership(bytes32 projectId, address nextOwner) external onlyProjectOwner(projectId) {
        if (nextOwner == address(0)) revert InvalidProject();
        pendingProjectOwners[projectId] = nextOwner;
        emit ProjectOwnerTransferStarted(projectId, msg.sender, nextOwner);
    }

    function acceptProjectOwnership(bytes32 projectId) external {
        if (!projectExists[projectId] || pendingProjectOwners[projectId] != msg.sender) revert NotProjectOwner();
        address previousOwner = projectOwners[projectId];
        projectOwners[projectId] = msg.sender;
        pendingProjectOwners[projectId] = address(0);
        emit ProjectOwnerTransferred(projectId, previousOwner, msg.sender);
    }

    function setProjectAttestor(bytes32 projectId, address attestor, bool authorized) external onlyProjectOwner(projectId) {
        if (attestor == address(0)) revert InvalidProject();
        projectAttestors[projectId][attestor] = authorized;
        emit ProjectAttestorAuthorizationChanged(projectId, attestor, authorized);
    }

    function publishProjectAttestation(
        bytes32 projectId,
        bytes32 assetId,
        bytes32 attestationId,
        bytes32 evidenceRoot,
        bytes32 policyHash,
        bytes32 previousAttestation,
        uint64 validUntil,
        uint8 score,
        Status status
    ) external {
        if (!projectExists[projectId] || !projectAttestors[projectId][msg.sender]) revert NotProjectOwner();
        if (exists[attestationId]) revert AlreadyPublished();
        if (score > 100) revert InvalidScore();
        if (validUntil <= block.timestamp) revert InvalidValidityWindow();
        attestations[attestationId] = Attestation(evidenceRoot, policyHash, previousAttestation, uint64(block.timestamp), validUntil, score, status, msg.sender);
        exists[attestationId] = true;
        attestationProject[attestationId] = projectId;
        emit AttestationPublished(assetId, attestationId, evidenceRoot, policyHash, validUntil, score, status, msg.sender);
    }

    function setProjectStatus(bytes32 projectId, bytes32 assetId, bytes32 attestationId, Status status) external onlyProjectOwner(projectId) {
        if (attestationProject[attestationId] != projectId || !exists[attestationId]) revert UnknownAttestation();
        attestations[attestationId].status = status;
        emit AttestationStatusChanged(assetId, attestationId, status, msg.sender);
    }

    function setAttestor(address attestor, bool authorized) external {
        if (msg.sender != owner) revert NotOwner();
        authorizedAttestors[attestor] = authorized;
        emit AttestorAuthorizationChanged(attestor, authorized);
    }

    function transferOwnership(address nextOwner) external {
        if (msg.sender != owner) revert NotOwner();
        if (nextOwner == address(0)) revert NotOwner();
        pendingOwner = nextOwner;
        emit OwnershipTransferStarted(owner, nextOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        authorizedAttestors[previousOwner] = false;
        authorizedAttestors[msg.sender] = true;
        emit AttestorAuthorizationChanged(previousOwner, false);
        emit AttestorAuthorizationChanged(msg.sender, true);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function publishAttestation(
        bytes32 assetId,
        bytes32 attestationId,
        bytes32 evidenceRoot,
        bytes32 policyHash,
        bytes32 previousAttestation,
        uint64 validUntil,
        uint8 score,
        Status status
    ) external {
        if (!authorizedAttestors[msg.sender]) revert NotAuthorizedAttestor();
        if (exists[attestationId]) revert AlreadyPublished();
        if (score > 100) revert InvalidScore();
        if (validUntil <= block.timestamp) revert InvalidValidityWindow();
        attestations[attestationId] = Attestation(evidenceRoot, policyHash, previousAttestation, uint64(block.timestamp), validUntil, score, status, msg.sender);
        exists[attestationId] = true;
        emit AttestationPublished(assetId, attestationId, evidenceRoot, policyHash, validUntil, score, status, msg.sender);
    }

    function setStatus(bytes32 assetId, bytes32 attestationId, Status status) external {
        if (msg.sender != owner && !authorizedAttestors[msg.sender]) revert NotAuthorizedAttestor();
        if (!exists[attestationId]) revert UnknownAttestation();
        attestations[attestationId].status = status;
        emit AttestationStatusChanged(assetId, attestationId, status, msg.sender);
    }

    function getAttestation(bytes32 attestationId) external view returns (Attestation memory) {
        if (!exists[attestationId]) revert UnknownAttestation();
        return attestations[attestationId];
    }

    function isEligible(bytes32 attestationId, uint8 minimumScore) external view returns (bool) {
        if (!exists[attestationId]) return false;
        Attestation memory attestation = attestations[attestationId];
        return attestation.status == Status.Verified && attestation.score >= minimumScore && attestation.validUntil > block.timestamp;
    }

    function isProjectEligible(bytes32 projectId, bytes32 attestationId, uint8 minimumScore) external view returns (bool) {
        if (!projectExists[projectId] || attestationProject[attestationId] != projectId || !exists[attestationId]) return false;
        Attestation memory attestation = attestations[attestationId];
        return attestation.status == Status.Verified && attestation.score >= minimumScore && attestation.validUntil > block.timestamp;
    }
}
