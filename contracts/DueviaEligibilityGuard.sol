// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDueviaAssetAssuranceRegistry {
    function isEligible(bytes32 attestationId, uint8 minimumScore) external view returns (bool);
}

/// @title Duevia Eligibility Guard
/// @notice Example integration point: require a valid Duevia attestation before an asset enters a pool or mint flow.
contract DueviaEligibilityGuard {
    IDueviaAssetAssuranceRegistry public immutable registry;
    uint8 public immutable minimumScore;

    error AssetNotEligible();

    constructor(address registryAddress, uint8 minimumScore_) {
        registry = IDueviaAssetAssuranceRegistry(registryAddress);
        minimumScore = minimumScore_;
    }

    function requireEligible(bytes32 attestationId) external view {
        if (!registry.isEligible(attestationId, minimumScore)) revert AssetNotEligible();
    }
}
