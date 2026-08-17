// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TestBase.sol";
import "../contracts/DueviaAssetAssuranceRegistry.sol";
import "../contracts/DueviaRecoveryCoordinator.sol";
import "../contracts/DueviaContinuityGuard.sol";
import "../contracts/DueviaContinuityPool.sol";
import "../contracts/DueviaObserverQuorum.sol";
import "../contracts/DueviaRecoveryMultisig.sol";

contract QuorumTarget {
    uint256 public calls;
    function ping() external { calls += 1; }
}

contract DueviaPoolAndQuorumTest is TestBase {
    DueviaAssetAssuranceRegistry internal registry;
    DueviaRecoveryCoordinator internal coordinator;
    DueviaContinuityGuard internal guard;
    DueviaContinuityPool internal pool;
    bytes32 internal attestationId = keccak256("attestation");
    bytes32 internal incidentId = keccak256("incident");
    bytes32 internal projectId = keccak256("project");
    address internal user = address(0x2001);
    address internal observerA = address(0x2101);
    address internal observerB = address(0x2102);
    address internal observerC = address(0x2103);
    address internal signerA = address(0x2201);
    address internal signerB = address(0x2202);
    address internal signerC = address(0x2203);

    function setUp() public {
        registry = new DueviaAssetAssuranceRegistry(address(this));
        coordinator = new DueviaRecoveryCoordinator(address(this));
        guard = new DueviaContinuityGuard(address(registry), address(coordinator), 80, projectId);
        pool = new DueviaContinuityPool(address(guard));
        registry.registerProject(projectId, address(this));
        registry.setProjectAttestor(projectId, address(this), true);
        coordinator.registerProject(projectId, address(this));
        coordinator.setProjectOperator(projectId, address(this), true);
        registry.publishProjectAttestation(projectId, keccak256("asset"), attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp + 1 days), 95, DueviaAssetAssuranceRegistry.Status.Verified);
        coordinator.openProjectIncident(projectId, incidentId, keccak256("pool"), keccak256("servicer"), bytes32(uint256(1)), uint64(block.timestamp));
        vm.deal(user, 100 ether);
    }

    function testPoolRejectsWhileSuspendedAndAllowsAfterVerified() public {
        vm.prank(user);
        vm.expectRevert(DueviaContinuityGuard.IncidentNotVerified.selector);
        pool.deposit{value: 1 ether}(attestationId, incidentId);
        coordinator.recordProjectRecovery(projectId, incidentId, bytes32(uint256(4)), DueviaRecoveryCoordinator.State.Reconstructed);
        coordinator.proposeProjectSuccessor(projectId, incidentId, address(0x2301));
        coordinator.verifyProjectSuccessor(projectId, incidentId, bytes32(uint256(5)));
        vm.prank(user);
        pool.deposit{value: 1 ether}(attestationId, incidentId);
        assertEq(pool.totalDeposited(), 1 ether);
        assertEq(address(pool).balance, pool.totalDeposited());
        vm.prank(user);
        pool.withdraw(1 ether);
        assertEq(pool.totalDeposited(), 0);
        assertEq(address(pool).balance, 0);
    }

    function testFuzzPoolConservesValue(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) % 10 ether + 1 wei;
        coordinator.recordProjectRecovery(projectId, incidentId, bytes32(uint256(4)), DueviaRecoveryCoordinator.State.Reconstructed);
        coordinator.proposeProjectSuccessor(projectId, incidentId, address(0x2301));
        coordinator.verifyProjectSuccessor(projectId, incidentId, bytes32(uint256(5)));
        vm.deal(user, amount);
        vm.prank(user);
        pool.deposit{value: amount}(attestationId, incidentId);
        assertEq(address(pool).balance, pool.totalDeposited());
        vm.prank(user);
        pool.withdraw(amount);
        assertEq(address(pool).balance, pool.totalDeposited());
        assertEq(pool.totalDeposited(), 0);
    }

    function testObserverReplayAndQuorumExecution() public {
        address[] memory observers = new address[](3);
        observers[0] = observerA; observers[1] = observerB; observers[2] = observerC;
        DueviaObserverQuorum quorum = new DueviaObserverQuorum(observers, 2);
        QuorumTarget target = new QuorumTarget();
        bytes memory data = abi.encodeCall(QuorumTarget.ping, ());
        vm.prank(observerA);
        quorum.submit(keccak256("incident"), 1, keccak256("report"), address(target), data);
        vm.prank(observerA);
        vm.expectRevert(DueviaObserverQuorum.AlreadyVoted.selector);
        quorum.submit(keccak256("incident"), 1, keccak256("report"), address(target), data);
        vm.prank(observerB);
        quorum.submit(keccak256("incident"), 1, keccak256("report"), address(target), data);
        quorum.execute(keccak256("incident"), 1, keccak256("report"), address(target), data);
        assertEq(target.calls(), 1);
        vm.expectRevert(DueviaObserverQuorum.AlreadyExecuted.selector);
        quorum.execute(keccak256("incident"), 1, keccak256("report"), address(target), data);
    }

    function testMultisigRequiresDistinctSignersAndCannotReplayExecutedNonce() public {
        address[] memory signers = new address[](3);
        signers[0] = signerA; signers[1] = signerB; signers[2] = signerC;
        DueviaRecoveryMultisig multisig = new DueviaRecoveryMultisig(signers, 2);
        QuorumTarget target = new QuorumTarget();
        bytes memory data = abi.encodeCall(QuorumTarget.ping, ());
        vm.prank(signerA);
        multisig.approve(address(target), 0, data);
        vm.prank(signerA);
        vm.expectRevert(DueviaRecoveryMultisig.AlreadyApproved.selector);
        multisig.approve(address(target), 0, data);
        vm.prank(signerB);
        multisig.approve(address(target), 0, data);
        vm.prank(signerC);
        multisig.execute(address(target), 0, data);
        assertEq(target.calls(), 1);
        vm.prank(signerC);
        vm.expectRevert(DueviaRecoveryMultisig.InsufficientApprovals.selector);
        multisig.execute(address(target), 0, data);
    }
}

contract DueviaPoolInvariantTest is TestBase {
    DueviaAssetAssuranceRegistry internal registry;
    DueviaRecoveryCoordinator internal coordinator;
    DueviaContinuityGuard internal guard;
    DueviaContinuityPool internal pool;
    bytes32 internal attestationId = keccak256("invariant-attestation");
    bytes32 internal incidentId = keccak256("invariant-incident");
    bytes32 internal projectId = keccak256("invariant-project");

    receive() external payable {}

    function setUp() public {
        registry = new DueviaAssetAssuranceRegistry(address(this));
        coordinator = new DueviaRecoveryCoordinator(address(this));
        guard = new DueviaContinuityGuard(address(registry), address(coordinator), 80, projectId);
        pool = new DueviaContinuityPool(address(guard));
        registry.registerProject(projectId, address(this));
        registry.setProjectAttestor(projectId, address(this), true);
        coordinator.registerProject(projectId, address(this));
        coordinator.setProjectOperator(projectId, address(this), true);
        registry.publishProjectAttestation(projectId, keccak256("asset"), attestationId, bytes32(uint256(1)), bytes32(uint256(2)), bytes32(0), uint64(block.timestamp + 30 days), 95, DueviaAssetAssuranceRegistry.Status.Verified);
        coordinator.openProjectIncident(projectId, incidentId, keccak256("pool"), keccak256("servicer"), bytes32(uint256(1)), uint64(block.timestamp));
        coordinator.recordProjectRecovery(projectId, incidentId, bytes32(uint256(4)), DueviaRecoveryCoordinator.State.Reconstructed);
        coordinator.proposeProjectSuccessor(projectId, incidentId, address(0x2301));
        coordinator.verifyProjectSuccessor(projectId, incidentId, bytes32(uint256(5)));
    }

    function actionDeposit(uint96 rawAmount) external {
        uint256 amount = uint256(rawAmount) % 1 ether + 1 wei;
        vm.deal(address(this), amount);
        pool.deposit{value: amount}(attestationId, incidentId);
    }

    function actionWithdraw(uint96 rawAmount) external {
        uint256 balance = pool.balances(address(this));
        if (balance == 0) return;
        uint256 amount = uint256(rawAmount) % balance + 1;
        pool.withdraw(amount);
    }

    function targetContracts() external view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(this);
    }

    function invariant_poolBalanceMatchesLedger() public view {
        assertEq(address(pool).balance, pool.totalDeposited());
    }
}
