// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDueviaRegistryV2 {
    function isEligible(bytes32 attestationId, uint8 minimumScore) external view returns (bool);
}

interface IDueviaRecoveryCoordinatorV2 {
    function isCapitalFlowAllowed(bytes32 incidentId) external view returns (bool);
}

/// @notice Requires both an eligible asset attestation and a verified recovery incident.
contract DueviaContinuityGuard {
    IDueviaRegistryV2 public immutable registry;
    IDueviaRecoveryCoordinatorV2 public immutable coordinator;
    uint8 public immutable minimumScore;

    error AssetNotEligible();
    error IncidentNotVerified();
    error InvalidConfiguration();

    constructor(address registryAddress, address coordinatorAddress, uint8 minimumScore_) {
        if (registryAddress == address(0) || coordinatorAddress == address(0) || minimumScore_ > 100) revert InvalidConfiguration();
        registry = IDueviaRegistryV2(registryAddress);
        coordinator = IDueviaRecoveryCoordinatorV2(coordinatorAddress);
        minimumScore = minimumScore_;
    }

    function requireOperational(bytes32 attestationId, bytes32 incidentId) external view {
        if (!registry.isEligible(attestationId, minimumScore)) revert AssetNotEligible();
        if (!coordinator.isCapitalFlowAllowed(incidentId)) revert IncidentNotVerified();
    }
}
