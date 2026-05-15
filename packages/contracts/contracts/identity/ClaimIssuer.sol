// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ClaimIssuer
 * @notice Emite claims firmadas que certifican atributos del inversionista (KYC, accreditación).
 * @dev Arkangeles actúa como ClaimIssuer en el MVP. Producción admite múltiples issuers.
 */
contract ClaimIssuer {
    address public issuer;

    constructor(address _issuer) {
        issuer = _issuer;
    }

    /// @notice Verifica que `signature` es del issuer sobre `claimHash`.
    function verifyClaim(bytes32 claimHash, bytes calldata signature) external view returns (bool) {
        // TODO: implementar EIP-191 / EIP-712 recovery
        // Placeholder para que compile durante el setup inicial.
        require(claimHash != bytes32(0), "empty claim");
        require(signature.length == 65, "bad signature length");
        return true;
    }
}
