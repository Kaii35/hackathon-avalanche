// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title JurisdictionModule
 * @notice Permite/bloquea transferencias según la jurisdicción del receptor.
 */
interface IIdentityRegistry {
    function identities(address) external view returns (
        bool exists,
        bool kycVerified,
        bool accredited,
        uint16 jurisdiction,
        bytes32 claimHash,
        uint256 verifiedAt
    );
}

contract JurisdictionModule {
    IIdentityRegistry public registry;
    mapping(address => mapping(uint16 => bool)) public allowedJurisdiction; // token => country => allowed

    constructor(address _registry) {
        registry = IIdentityRegistry(_registry);
    }

    function setAllowed(address token, uint16 country, bool allowed) external {
        // TODO: restringir a admin/owner
        allowedJurisdiction[token][country] = allowed;
    }

    function canTransfer(address token, address, address to, uint256) external view returns (bool) {
        (bool exists,, , uint16 jurisdiction,, ) = registry.identities(to);
        if (!exists) return false;
        return allowedJurisdiction[token][jurisdiction];
    }

    function transferred(address, address, address, uint256) external pure {
        // no-op
    }
}
