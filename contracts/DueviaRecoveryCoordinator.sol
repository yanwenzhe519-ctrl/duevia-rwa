// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Duevia Recovery Coordinator
/// @notice Protocol state machine for RWA servicing failure and authorized handoff.
/// @dev It stores hashes and approvals only. Asset records remain offchain.
contract DueviaRecoveryCoordinator {
    enum State { None, Suspended, Reconstructed, Review, Restructuring, Verified, Closed }

    struct Incident {
        bytes32 poolId;
        bytes32 servicerId;
        bytes32 previousAttestation;
        bytes32 recoveryRoot;
        bytes32 successorAttestation;
        uint64 openedAt;
        uint64 lastTrustedAt;
        State state;
        address successor;
    }

    address public owner;
    address public pendingOwner;
    mapping(address => bool) public operators;
    mapping(bytes32 => Incident) private incidents;

    error NotOwner();
    error NotOperator();
    error InvalidIncident();
    error InvalidTransition();
    error UnknownIncident();

    event OperatorChanged(address indexed operator, bool enabled);
    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event IncidentOpened(bytes32 indexed incidentId, bytes32 indexed poolId, bytes32 indexed servicerId, bytes32 previousAttestation, uint64 lastTrustedAt);
    event RecoveryRecorded(bytes32 indexed incidentId, bytes32 recoveryRoot, State state);
    event SuccessorProposed(bytes32 indexed incidentId, address indexed successor);
    event SuccessorVerified(bytes32 indexed incidentId, bytes32 indexed successorAttestation, address indexed successor);
    event IncidentStateChanged(bytes32 indexed incidentId, State state);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert NotOwner();
        owner = initialOwner;
        operators[initialOwner] = true;
        emit OperatorChanged(initialOwner, true);
    }

    function transferOwnership(address nextOwner) external {
        if (msg.sender != owner || nextOwner == address(0)) revert NotOwner();
        pendingOwner = nextOwner;
        emit OwnershipTransferStarted(owner, nextOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        operators[previousOwner] = false;
        operators[owner] = true;
        emit OperatorChanged(previousOwner, false);
        emit OperatorChanged(owner, true);
        emit OwnershipTransferred(previousOwner, owner);
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator();
        _;
    }

    function setOperator(address operator, bool enabled) external {
        if (msg.sender != owner) revert NotOwner();
        operators[operator] = enabled;
        emit OperatorChanged(operator, enabled);
    }

    function openIncident(
        bytes32 incidentId,
        bytes32 poolId,
        bytes32 servicerId,
        bytes32 previousAttestation,
        uint64 lastTrustedAt
    ) external onlyOperator {
        if (incidentId == bytes32(0) || poolId == bytes32(0) || servicerId == bytes32(0) || lastTrustedAt > block.timestamp) revert InvalidIncident();
        if (incidents[incidentId].state != State.None) revert InvalidIncident();
        incidents[incidentId] = Incident(poolId, servicerId, previousAttestation, bytes32(0), bytes32(0), uint64(block.timestamp), lastTrustedAt, State.Suspended, address(0));
        emit IncidentOpened(incidentId, poolId, servicerId, previousAttestation, lastTrustedAt);
    }

    function recordRecovery(bytes32 incidentId, bytes32 recoveryRoot, State nextState) external onlyOperator {
        Incident storage incident = incidents[incidentId];
        if (incident.state == State.None || incident.state == State.Closed || recoveryRoot == bytes32(0)) revert UnknownIncident();
        if (nextState != State.Reconstructed && nextState != State.Review && nextState != State.Restructuring) revert InvalidTransition();
        if (incident.state != State.Suspended && incident.state != State.Review && incident.state != State.Restructuring) revert InvalidTransition();
        incident.recoveryRoot = recoveryRoot;
        incident.state = nextState;
        emit RecoveryRecorded(incidentId, recoveryRoot, nextState);
    }

    function proposeSuccessor(bytes32 incidentId, address successor) external onlyOperator {
        Incident storage incident = incidents[incidentId];
        if (incident.state == State.None || incident.state == State.Closed || successor == address(0)) revert UnknownIncident();
        if (incident.state == State.Verified) revert InvalidTransition();
        incident.successor = successor;
        emit SuccessorProposed(incidentId, successor);
    }

    function verifySuccessor(bytes32 incidentId, bytes32 successorAttestation) external {
        Incident storage incident = incidents[incidentId];
        if (incident.state == State.None || incident.state == State.Closed) revert UnknownIncident();
        if (msg.sender != owner && !operators[msg.sender]) revert NotOperator();
        if (incident.state != State.Reconstructed || incident.recoveryRoot == bytes32(0) || incident.successor == address(0) || successorAttestation == bytes32(0)) revert InvalidTransition();
        incident.successorAttestation = successorAttestation;
        incident.state = State.Verified;
        emit SuccessorVerified(incidentId, successorAttestation, incident.successor);
    }

    function markRestructuring(bytes32 incidentId) external onlyOperator {
        Incident storage incident = incidents[incidentId];
        if (incident.state != State.Suspended && incident.state != State.Review) revert InvalidTransition();
        incident.state = State.Restructuring;
        emit IncidentStateChanged(incidentId, State.Restructuring);
    }

    function closeIncident(bytes32 incidentId) external onlyOperator {
        Incident storage incident = incidents[incidentId];
        if (incident.state != State.Verified) revert InvalidTransition();
        incident.state = State.Closed;
        emit IncidentStateChanged(incidentId, State.Closed);
    }

    function getIncident(bytes32 incidentId) external view returns (Incident memory) {
        if (incidents[incidentId].state == State.None) revert UnknownIncident();
        return incidents[incidentId];
    }

    function isCapitalFlowAllowed(bytes32 incidentId) external view returns (bool) {
        return incidents[incidentId].state == State.Verified;
    }
}
