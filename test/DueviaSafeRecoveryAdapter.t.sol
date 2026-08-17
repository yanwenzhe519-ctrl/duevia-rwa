// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";
import "../contracts/DueviaSafeRecoveryAdapter.sol";

contract SafeTarget {
    uint256 public value;
    function setValue(uint256 next) external { value = next; }
}

contract DueviaSafeRecoveryAdapterTest is TestBase {
    address internal safe = address(0xBEEF);
    bytes32 internal projectId = keccak256("project");
    bytes32 internal incidentId = keccak256("incident");
    bytes32 internal recoveryRoot = keccak256("root");
    DueviaSafeRecoveryAdapter internal adapter;
    SafeTarget internal target;

    function setUp() public {
        adapter = new DueviaSafeRecoveryAdapter(safe, projectId);
        target = new SafeTarget();
    }

    function testOnlySafeCanExecuteAndReplayIsRejected() public {
        bytes memory data = abi.encodeCall(SafeTarget.setValue, (42));
        vm.expectRevert(DueviaSafeRecoveryAdapter.OnlySafe.selector);
        adapter.executeRecovery(incidentId, recoveryRoot, address(target), 0, data);
        vm.prank(safe);
        adapter.executeRecovery(incidentId, recoveryRoot, address(target), 0, data);
        assertEq(target.value(), 42);
        vm.prank(safe);
        vm.expectRevert(DueviaSafeRecoveryAdapter.AlreadyExecuted.selector);
        adapter.executeRecovery(incidentId, recoveryRoot, address(target), 0, data);
    }

    function testProjectBindingAndInvalidActions() public {
        assertEq(adapter.safe(), safe);
        assertTrue(adapter.projectId() == projectId);
        vm.prank(safe);
        vm.expectRevert(DueviaSafeRecoveryAdapter.InvalidAction.selector);
        adapter.executeRecovery(bytes32(0), recoveryRoot, address(target), 0, abi.encodeCall(SafeTarget.setValue, (1)));
    }
}
