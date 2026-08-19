// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract DueviaIncidentStateMachine is AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    enum State { NONE, ACTIVE, SUSPECTED, PROTECTED, RECONSTRUCTED, AUTHORIZED, EXECUTING, RECOVERED, RECONCILED }

    struct Incident {
        bytes32 projectId;
        bytes32 capsuleHash;
        bytes32 rulesHash;
        bytes32 governanceApprovalHash;
        uint64 nonce;
        State state;
    }

    mapping(bytes32 => Incident) private incidents;

    event IncidentOpened(bytes32 indexed incidentId, bytes32 indexed projectId, uint64 nonce);
    event Protected(bytes32 indexed incidentId, uint64 nonce);
    event ReconstructionSubmitted(bytes32 indexed incidentId, bytes32 capsuleHash, bytes32 rulesHash, uint64 nonce);
    event GovernanceAuthorized(bytes32 indexed incidentId, bytes32 governanceApprovalHash, uint64 nonce);
    event RecoveryExecuting(bytes32 indexed incidentId, uint64 nonce);
    event RecoveryExecuted(bytes32 indexed incidentId, bytes32 capsuleHash, uint64 nonce);
    event RuntimeResumed(bytes32 indexed incidentId, uint64 nonce);
    event IncidentReconciled(bytes32 indexed incidentId, uint64 nonce);
    event DisputeOpened(bytes32 indexed incidentId, bytes32 indexed evidenceHash, address indexed opener);

    error InvalidIncident();
    error InvalidTransition();
    error InvalidNonce();

    constructor(address admin) {
        if (admin == address(0)) revert InvalidIncident();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
    }

    function open(bytes32 incidentId, bytes32 projectId, uint64 nonce) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (incidentId == bytes32(0) || projectId == bytes32(0) || nonce == 0 || incidents[incidentId].state != State.NONE) revert InvalidIncident();
        incidents[incidentId] = Incident(projectId, bytes32(0), bytes32(0), bytes32(0), nonce, State.SUSPECTED);
        emit IncidentOpened(incidentId, projectId, nonce);
    }

    function protect(bytes32 incidentId, uint64 nonce) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Incident storage incident = _expect(incidentId, State.SUSPECTED, nonce);
        incident.state = State.PROTECTED;
        incident.nonce = nonce;
        emit Protected(incidentId, nonce);
    }

    function submitReconstruction(bytes32 incidentId, bytes32 capsuleHash, bytes32 rulesHash, uint64 nonce) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (capsuleHash == bytes32(0) || rulesHash == bytes32(0)) revert InvalidIncident();
        Incident storage incident = _expect(incidentId, State.PROTECTED, nonce);
        incident.capsuleHash = capsuleHash;
        incident.rulesHash = rulesHash;
        incident.state = State.RECONSTRUCTED;
        incident.nonce = nonce;
        emit ReconstructionSubmitted(incidentId, capsuleHash, rulesHash, nonce);
    }

    function authorize(bytes32 incidentId, bytes32 governanceApprovalHash, uint64 nonce) external onlyRole(GOVERNANCE_ROLE) whenNotPaused {
        if (governanceApprovalHash == bytes32(0)) revert InvalidIncident();
        Incident storage incident = _expect(incidentId, State.RECONSTRUCTED, nonce);
        incident.governanceApprovalHash = governanceApprovalHash;
        incident.state = State.AUTHORIZED;
        incident.nonce = nonce;
        emit GovernanceAuthorized(incidentId, governanceApprovalHash, nonce);
    }

    function beginExecution(bytes32 incidentId, uint64 nonce) external onlyRole(EXECUTOR_ROLE) whenNotPaused {
        Incident storage incident = _expect(incidentId, State.AUTHORIZED, nonce);
        incident.state = State.EXECUTING;
        incident.nonce = nonce;
        emit RecoveryExecuting(incidentId, nonce);
    }

    function markRecovered(bytes32 incidentId, uint64 nonce) external onlyRole(EXECUTOR_ROLE) whenNotPaused {
        Incident storage incident = _expect(incidentId, State.EXECUTING, nonce);
        incident.state = State.RECOVERED;
        incident.nonce = nonce;
        emit RecoveryExecuted(incidentId, incident.capsuleHash, nonce);
    }

    function resume(bytes32 incidentId, uint64 nonce) external onlyRole(GOVERNANCE_ROLE) whenNotPaused {
        Incident storage incident = _expect(incidentId, State.RECOVERED, nonce);
        incident.state = State.ACTIVE;
        incident.nonce = nonce;
        emit RuntimeResumed(incidentId, nonce);
    }

    function reconcile(bytes32 incidentId, uint64 nonce) external onlyRole(GOVERNANCE_ROLE) whenNotPaused {
        Incident storage incident = _expect(incidentId, State.ACTIVE, nonce);
        incident.state = State.RECONCILED;
        incident.nonce = nonce;
        emit IncidentReconciled(incidentId, nonce);
    }

    function openDispute(bytes32 incidentId, bytes32 evidenceHash) external {
        if (incidents[incidentId].state == State.NONE || evidenceHash == bytes32(0)) revert InvalidIncident();
        emit DisputeOpened(incidentId, evidenceHash, msg.sender);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
    function getIncident(bytes32 incidentId) external view returns (Incident memory) { return incidents[incidentId]; }

    function _expect(bytes32 incidentId, State state, uint64 nonce) private view returns (Incident storage incident) {
        incident = incidents[incidentId];
        if (incident.state != state) revert InvalidTransition();
        if (nonce != incident.nonce + 1) revert InvalidNonce();
    }
}
