// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";
import "../contracts/DueviaAssetAssuranceRegistry.sol";
import "../contracts/DueviaRecoveryCoordinator.sol";

contract DueviaRegistryCoordinatorTest is TestBase {
    DueviaAssetAssuranceRegistry internal registry;
    DueviaRecoveryCoordinator internal coordinator;
    address internal oldOwner = address(0x1001);
    address internal nextOwner = address(0x1002);
    address internal outsider = address(0x1003);
    bytes32 internal assetId = keccak256("asset-1");
    bytes32 internal attestationId = keccak256("attestation-1");
    bytes32 internal incidentId = keccak256("incident-1");
    bytes32 internal poolId = keccak256("pool-1");
    bytes32 internal servicerId = keccak256("servicer-1");
    bytes32 internal projectA = keccak256("project-a");
    bytes32 internal projectB = keccak256("project-b");
    address internal projectOwnerA = address(0x1101);
    address internal projectOwnerB = address(0x1102);

    function setUp() public {
        vm.prank(oldOwner);
        registry = new DueviaAssetAssuranceRegistry(oldOwner);
        vm.prank(oldOwner);
        coordinator = new DueviaRecoveryCoordinator(oldOwner);
    }

    function testUnauthorizedAttestorCannotPublish() public {
        vm.prank(outsider);
        vm.expectRevert(DueviaAssetAssuranceRegistry.NotAuthorizedAttestor.selector);
        registry.publishAttestation(assetId, attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp + 1 days), 90, DueviaAssetAssuranceRegistry.Status.Verified);
    }

    function testRegistryRejectsReplayAndExpiredValidity() public {
        vm.prank(oldOwner);
        vm.expectRevert(DueviaAssetAssuranceRegistry.InvalidValidityWindow.selector);
        registry.publishAttestation(assetId, attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp), 90, DueviaAssetAssuranceRegistry.Status.Verified);
        vm.prank(oldOwner);
        registry.publishAttestation(assetId, attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp + 1 days), 90, DueviaAssetAssuranceRegistry.Status.Verified);
        vm.prank(oldOwner);
        vm.expectRevert(DueviaAssetAssuranceRegistry.AlreadyPublished.selector);
        registry.publishAttestation(assetId, attestationId, bytes32(uint256(3)), bytes32(uint256(4)), bytes32(0), uint64(block.timestamp + 1 days), 90, DueviaAssetAssuranceRegistry.Status.Verified);
    }

    function testOwnershipTransferRevokesBootstrap() public {
        vm.prank(oldOwner);
        registry.transferOwnership(nextOwner);
        vm.prank(nextOwner);
        registry.acceptOwnership();
        assertEq(registry.owner(), nextOwner);
        assertFalse(registry.authorizedAttestors(oldOwner));
        assertTrue(registry.authorizedAttestors(nextOwner));
        vm.prank(oldOwner);
        vm.expectRevert(DueviaAssetAssuranceRegistry.NotAuthorizedAttestor.selector);
        registry.publishAttestation(assetId, attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp + 1 days), 90, DueviaAssetAssuranceRegistry.Status.Verified);
    }

    function testCoordinatorRejectsInvalidStateTransitions() public {
        vm.prank(oldOwner);
        vm.expectRevert(DueviaRecoveryCoordinator.InvalidIncident.selector);
        coordinator.openIncident(bytes32(0), poolId, servicerId, bytes32(0), uint64(block.timestamp));
        vm.prank(oldOwner);
        coordinator.openIncident(incidentId, poolId, servicerId, bytes32(0), uint64(block.timestamp));
        vm.prank(oldOwner);
        vm.expectRevert(DueviaRecoveryCoordinator.InvalidTransition.selector);
        coordinator.verifySuccessor(incidentId, bytes32(uint256(1)));
        vm.prank(oldOwner);
        vm.expectRevert(DueviaRecoveryCoordinator.InvalidIncident.selector);
        coordinator.openIncident(incidentId, poolId, servicerId, bytes32(0), uint64(block.timestamp));
    }

    function testCoordinatorLifecycleOnlyAllowsVerifiedAfterReconstruction() public {
        vm.prank(oldOwner);
        coordinator.openIncident(incidentId, poolId, servicerId, bytes32(uint256(1)), uint64(block.timestamp));
        vm.prank(oldOwner);
        coordinator.recordRecovery(incidentId, bytes32(uint256(2)), DueviaRecoveryCoordinator.State.Reconstructed);
        vm.prank(oldOwner);
        coordinator.proposeSuccessor(incidentId, nextOwner);
        vm.prank(oldOwner);
        coordinator.verifySuccessor(incidentId, bytes32(uint256(3)));
        assertTrue(coordinator.isCapitalFlowAllowed(incidentId));
    }

    function testProjectGovernanceCannotCrossControlProjects() public {
        vm.prank(oldOwner);
        registry.registerProject(projectA, projectOwnerA);
        vm.prank(oldOwner);
        registry.registerProject(projectB, projectOwnerB);
        vm.prank(projectOwnerA);
        registry.setProjectAttestor(projectA, projectOwnerA, true);
        vm.prank(projectOwnerB);
        vm.expectRevert(DueviaAssetAssuranceRegistry.NotProjectOwner.selector);
        registry.setProjectAttestor(projectA, projectOwnerB, true);
        vm.prank(projectOwnerB);
        vm.expectRevert(DueviaAssetAssuranceRegistry.NotProjectOwner.selector);
        registry.publishProjectAttestation(projectA, assetId, attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp + 1 days), 95, DueviaAssetAssuranceRegistry.Status.Verified);
        vm.prank(projectOwnerA);
        registry.publishProjectAttestation(projectA, assetId, attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp + 1 days), 95, DueviaAssetAssuranceRegistry.Status.Verified);
        assertTrue(registry.isProjectEligible(projectA, attestationId, 80));
        assertFalse(registry.isProjectEligible(projectB, attestationId, 80));

        vm.prank(oldOwner);
        coordinator.registerProject(projectA, projectOwnerA);
        vm.prank(oldOwner);
        coordinator.registerProject(projectB, projectOwnerB);
        vm.prank(projectOwnerA);
        coordinator.setProjectOperator(projectA, projectOwnerA, true);
        vm.prank(projectOwnerB);
        coordinator.setProjectOperator(projectB, projectOwnerB, true);
        vm.prank(projectOwnerB);
        vm.expectRevert(DueviaRecoveryCoordinator.NotOperator.selector);
        coordinator.openProjectIncident(projectA, incidentId, poolId, servicerId, bytes32(0), uint64(block.timestamp));
        vm.prank(projectOwnerA);
        coordinator.openProjectIncident(projectA, incidentId, poolId, servicerId, bytes32(0), uint64(block.timestamp));
        assertFalse(coordinator.isProjectCapitalFlowAllowed(projectB, incidentId));
    }
}
