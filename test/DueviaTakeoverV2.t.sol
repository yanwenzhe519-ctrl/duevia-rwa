// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "./TestBase.sol";
import {DueviaRwaRegistry} from "../contracts/DueviaRwaRegistry.sol";
import {DueviaCheckpointRegistry} from "../contracts/DueviaCheckpointRegistry.sol";
import {DueviaIncidentStateMachine} from "../contracts/DueviaIncidentStateMachine.sol";
import {DueviaRwaVault} from "../contracts/DueviaRwaVault.sol";
import {DueviaRecoveryAdapterV2} from "../contracts/DueviaRecoveryAdapterV2.sol";

contract DueviaTakeoverV2Test is TestBase {
    address internal user = address(0xBEEF);
    bytes32 internal projectId = keccak256("DUEVIA_SAMPLE_RWA");
    bytes32 internal incidentId = keccak256("INCIDENT_1");

    function testRegistryAndCheckpointRejectReplay() public {
        DueviaRwaVault vault = new DueviaRwaVault(address(this));
        DueviaRecoveryAdapterV2 adapter = new DueviaRecoveryAdapterV2(address(this), vault);
        DueviaRwaRegistry registry = new DueviaRwaRegistry(address(this));
        registry.register(projectId, DueviaRwaRegistry.Project(address(vault), keccak256("issuer"), keccak256("servicer"), address(adapter), keccak256("policy"), keccak256("5m"), address(this), keccak256("observers"), keccak256("bounded-diff"), 1, true));
        assertEq(uint256(registry.projectByContract(address(vault))), uint256(projectId));

        DueviaCheckpointRegistry checkpoints = new DueviaCheckpointRegistry(address(this));
        DueviaCheckpointRegistry.Checkpoint memory checkpoint = DueviaCheckpointRegistry.Checkpoint(uint64(block.chainid), address(vault), 10, keccak256("assets"), keccak256("accounts"), keccak256("yield"), keccak256("redemptions"), keccak256("evidence"), uint64(block.timestamp), 1, 10, 1);
        checkpoints.commit(projectId, checkpoint);
        vm.expectRevert(DueviaCheckpointRegistry.InvalidNonce.selector);
        checkpoints.commit(projectId, checkpoint);
    }

    function testIncidentLifecycleRequiresOrderedNonces() public {
        DueviaIncidentStateMachine machine = new DueviaIncidentStateMachine(address(this));
        machine.open(incidentId, projectId, 1);
        vm.expectRevert(DueviaIncidentStateMachine.InvalidNonce.selector);
        machine.protect(incidentId, 3);
        machine.protect(incidentId, 2);
        machine.submitReconstruction(incidentId, keccak256("capsule"), keccak256("rules-pass"), 3);
        machine.authorize(incidentId, keccak256("2-of-3"), 4);
        machine.beginExecution(incidentId, 5);
        machine.markRecovered(incidentId, 6);
        machine.resume(incidentId, 7);
        machine.reconcile(incidentId, 8);
        assertEq(uint256(machine.getIncident(incidentId).state), uint256(DueviaIncidentStateMachine.State.RECONCILED));
    }

    function testAdapterProtectsAppliesBoundedDiffAndRejectsReplay() public {
        DueviaRwaVault vault = new DueviaRwaVault(address(this));
        DueviaRecoveryAdapterV2 adapter = new DueviaRecoveryAdapterV2(address(this), vault);
        vault.grantRole(vault.ADAPTER_ROLE(), address(adapter));
        vm.deal(user, 2 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();

        adapter.protect(incidentId);
        DueviaRecoveryAdapterV2.AccountDiff[] memory diff = new DueviaRecoveryAdapterV2.AccountDiff[](1);
        diff[0] = DueviaRecoveryAdapterV2.AccountDiff(user, -int256(0.1 ether), int256(0.01 ether), int256(0.1 ether));
        bytes32 capsule = keccak256("capsule");
        adapter.applyRecovery(capsule, diff);
        assertEq(vault.principal(user), 0.9 ether);
        assertEq(vault.totalPrincipal(), 0.9 ether);
        assertEq(vault.accruedYield(user), 0.01 ether);
        assertEq(vault.totalYield(), 0.01 ether);
        assertEq(vault.pendingRedemption(user), 0.1 ether);
        vm.expectRevert(DueviaRecoveryAdapterV2.Replay.selector);
        adapter.applyRecovery(capsule, diff);
        adapter.resume(incidentId);
        assertFalse(vault.paused());
    }

    function testRedemptionSettlementBindsAndConsumesRequest() public {
        DueviaRwaVault vault = new DueviaRwaVault(address(this));
        vm.deal(user, 1 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();
        bytes32 requestId = keccak256("redemption");
        vm.prank(user);
        vault.requestRedemption(requestId, 0.4 ether);
        vm.expectRevert(DueviaRwaVault.InvalidRedemptionRequest.selector);
        vault.settleRedemption(address(this), requestId, 0.4 ether);
        vault.settleRedemption(user, requestId, 0.4 ether);
        vm.expectRevert(DueviaRwaVault.InvalidRedemptionRequest.selector);
        vault.settleRedemption(user, requestId, 0.4 ether);
    }
}
