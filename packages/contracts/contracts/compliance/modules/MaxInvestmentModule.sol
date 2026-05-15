// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MaxInvestmentModule
 * @notice Limita el monto máximo invertido por inversionista no calificado.
 */
interface IIdentityRegistry2 {
    function identities(address) external view returns (
        bool exists,
        bool kycVerified,
        bool accredited,
        uint16 jurisdiction,
        bytes32 claimHash,
        uint256 verifiedAt
    );
}

contract MaxInvestmentModule {
    IIdentityRegistry2 public registry;
    mapping(address => uint256) public maxPerNonAccredited; // token => max units

    constructor(address _registry) {
        registry = IIdentityRegistry2(_registry);
    }

    function setMax(address token, uint256 max) external {
        // TODO: restringir a admin/owner
        maxPerNonAccredited[token] = max;
    }

    function canTransfer(
        address token,
        address,
        address to,
        uint256 amount
    ) external view returns (bool) {
        (bool exists,, bool accredited,,, ) = registry.identities(to);
        if (!exists) return false;
        if (accredited) return true;
        // Para no acreditados: la verificación del balance acumulado se hace al lado del SecurityToken
        // (necesita saber el balance actual del receptor). Por ahora bloqueamos si amount excede el límite.
        return amount <= maxPerNonAccredited[token];
    }

    function transferred(address, address, address, uint256) external pure {
        // no-op
    }
}
