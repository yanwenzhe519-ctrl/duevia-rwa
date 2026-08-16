// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Independent observers must agree on the same incident report before an action can execute.
contract DueviaObserverQuorum {
    mapping(address => bool) public isObserver;
    mapping(bytes32 => mapping(address => bool)) public voted;
    mapping(bytes32 => uint256) public votes;
    mapping(bytes32 => bool) public executed;
    uint256 public immutable threshold;

    error NotObserver();
    error InvalidConfiguration();
    error AlreadyVoted();
    error QuorumNotReached();
    error AlreadyExecuted();
    error ExecutionFailed();

    event ObservationSubmitted(bytes32 indexed quorumId, bytes32 indexed incidentId, uint64 indexed epoch, bytes32 reportHash, address observer, uint256 votes);
    event QuorumExecuted(bytes32 indexed quorumId, address indexed target);

    constructor(address[] memory observers, uint256 threshold_) {
        if (threshold_ < 2 || threshold_ > observers.length) revert InvalidConfiguration();
        for (uint256 i; i < observers.length; i++) {
            if (observers[i] == address(0) || isObserver[observers[i]]) revert InvalidConfiguration();
            isObserver[observers[i]] = true;
        }
        threshold = threshold_;
    }

    function quorumId(bytes32 incidentId, uint64 epoch, bytes32 reportHash) public pure returns (bytes32) {
        return keccak256(abi.encode(incidentId, epoch, reportHash));
    }

    function submit(bytes32 incidentId, uint64 epoch, bytes32 reportHash) external returns (bytes32 id) {
        if (!isObserver[msg.sender]) revert NotObserver();
        id = quorumId(incidentId, epoch, reportHash);
        if (voted[id][msg.sender]) revert AlreadyVoted();
        voted[id][msg.sender] = true;
        votes[id] += 1;
        emit ObservationSubmitted(id, incidentId, epoch, reportHash, msg.sender, votes[id]);
    }

    function execute(bytes32 incidentId, uint64 epoch, bytes32 reportHash, address target, bytes calldata data) external returns (bytes memory result) {
        bytes32 id = quorumId(incidentId, epoch, reportHash);
        if (votes[id] < threshold) revert QuorumNotReached();
        if (executed[id]) revert AlreadyExecuted();
        executed[id] = true;
        (bool ok, bytes memory response) = target.call(data);
        if (!ok) revert ExecutionFailed();
        emit QuorumExecuted(id, target);
        return response;
    }
}

