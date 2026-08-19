// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract DueviaRwaRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Project {
        address rwaContract;
        bytes32 issuerId;
        bytes32 servicerId;
        address recoveryAdapter;
        bytes32 dataPolicyHash;
        bytes32 checkpointPolicy;
        address governance;
        bytes32 observerSetHash;
        bytes32 allowedRecoveryActions;
        uint32 version;
        bool active;
    }

    mapping(bytes32 => Project) private projects;
    mapping(address => bytes32) public projectByContract;

    event RwaRegistered(bytes32 indexed projectId, address indexed rwaContract, address indexed recoveryAdapter, address governance, uint32 version);
    event RwaActivationChanged(bytes32 indexed projectId, bool active);

    error InvalidProject();
    error ProjectAlreadyRegistered();

    constructor(address admin) {
        if (admin == address(0)) revert InvalidProject();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function register(bytes32 projectId, Project calldata project) external onlyRole(REGISTRAR_ROLE) {
        if (projectId == bytes32(0) || project.rwaContract == address(0) || project.recoveryAdapter == address(0) || project.governance == address(0) || project.version == 0) revert InvalidProject();
        if (projects[projectId].rwaContract != address(0) || projectByContract[project.rwaContract] != bytes32(0)) revert ProjectAlreadyRegistered();
        projects[projectId] = project;
        projectByContract[project.rwaContract] = projectId;
        emit RwaRegistered(projectId, project.rwaContract, project.recoveryAdapter, project.governance, project.version);
    }

    function setActive(bytes32 projectId, bool active) external onlyRole(REGISTRAR_ROLE) {
        if (projects[projectId].rwaContract == address(0)) revert InvalidProject();
        projects[projectId].active = active;
        emit RwaActivationChanged(projectId, active);
    }

    function getProject(bytes32 projectId) external view returns (Project memory) {
        Project memory project = projects[projectId];
        if (project.rwaContract == address(0)) revert InvalidProject();
        return project;
    }
}
