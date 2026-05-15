// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IdentityRegistry
 * @notice Mapea wallets a identidades verificadas con sus claims (KYC, jurisdicción, accreditación).
 * @dev Inspirado en el estándar ERC-3643 (T-REX). Solo wallets registradas pueden holdear/operar SecurityTokens.
 */
contract IdentityRegistry {
    struct Identity {
        bool exists;
        bool kycVerified;
        bool accredited;
        uint16 jurisdiction; // ISO 3166-1 numeric (484 = MX)
        bytes32 claimHash;
        uint256 verifiedAt;
    }

    mapping(address => Identity) public identities;
    mapping(address => bool) public agents; // wallets que pueden registrar identidades (KYC issuers)
    address public owner;

    event IdentityRegistered(address indexed wallet, uint16 jurisdiction, bool accredited);
    event IdentityRemoved(address indexed wallet);
    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAgent() {
        require(agents[msg.sender] || msg.sender == owner, "not agent");
        _;
    }

    constructor() {
        owner = msg.sender;
        agents[msg.sender] = true;
    }

    function addAgent(address agent) external onlyOwner {
        agents[agent] = true;
        emit AgentAdded(agent);
    }

    function removeAgent(address agent) external onlyOwner {
        agents[agent] = false;
        emit AgentRemoved(agent);
    }

    function registerIdentity(
        address wallet,
        uint16 jurisdiction,
        bool accredited,
        bytes32 claimHash
    ) external onlyAgent {
        identities[wallet] = Identity({
            exists: true,
            kycVerified: true,
            accredited: accredited,
            jurisdiction: jurisdiction,
            claimHash: claimHash,
            verifiedAt: block.timestamp
        });
        emit IdentityRegistered(wallet, jurisdiction, accredited);
    }

    function removeIdentity(address wallet) external onlyAgent {
        delete identities[wallet];
        emit IdentityRemoved(wallet);
    }

    function isVerified(address wallet) external view returns (bool) {
        return identities[wallet].exists && identities[wallet].kycVerified;
    }
}
