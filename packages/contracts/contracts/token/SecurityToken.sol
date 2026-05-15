// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SecurityToken
 * @notice ERC-20 con hooks de compliance: cada transfer consulta IdentityRegistry + ComplianceRegistry.
 *         Soporta freeze por wallet, forced transfer (recovery) y pause global (emergencia regulatoria).
 *         MVP minimalista; en producción se reemplaza por un fork del estándar T-REX (ERC-3643).
 */

interface IIdentityRegistry3 {
    function isVerified(address wallet) external view returns (bool);
}

interface ICompliance {
    function canTransfer(address token, address from, address to, uint256 amount) external view returns (bool);
    function notifyTransfer(address from, address to, uint256 amount) external;
}

contract SecurityToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public frozen;

    address public issuer;
    address public agent; // Settlement contract autorizado a hacer forced transfers
    bool public paused;

    IIdentityRegistry3 public identityRegistry;
    ICompliance public compliance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event WalletFrozen(address indexed wallet, bool frozen);
    event ForcedTransfer(address indexed from, address indexed to, uint256 value, string reason);
    event Paused(bool paused);

    modifier onlyIssuer() {
        require(msg.sender == issuer, "not issuer");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent || msg.sender == issuer, "not agent");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _issuer,
        address _identityRegistry,
        address _compliance
    ) {
        name = _name;
        symbol = _symbol;
        issuer = _issuer;
        identityRegistry = IIdentityRegistry3(_identityRegistry);
        compliance = ICompliance(_compliance);
    }

    function setAgent(address _agent) external onlyIssuer {
        agent = _agent;
    }

    function mint(address to, uint256 amount) external onlyIssuer whenNotPaused {
        require(identityRegistry.isVerified(to), "receiver not verified");
        require(compliance.canTransfer(address(this), address(0), to, amount), "compliance");
        balanceOf[to] += amount;
        totalSupply += amount;
        compliance.notifyTransfer(address(0), to, amount);
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external whenNotPaused returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(!frozen[from] && !frozen[to], "frozen");
        require(identityRegistry.isVerified(to), "receiver not verified");
        require(compliance.canTransfer(address(this), from, to, amount), "compliance");
        require(balanceOf[from] >= amount, "balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        compliance.notifyTransfer(from, to, amount);
        emit Transfer(from, to, amount);
    }

    function freezeWallet(address wallet, bool freeze) external onlyAgent {
        frozen[wallet] = freeze;
        emit WalletFrozen(wallet, freeze);
    }

    function forcedTransfer(address from, address to, uint256 amount, string calldata reason) external onlyAgent {
        require(identityRegistry.isVerified(to), "receiver not verified");
        require(balanceOf[from] >= amount, "balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit ForcedTransfer(from, to, amount, reason);
        emit Transfer(from, to, amount);
    }

    function setPaused(bool _paused) external onlyIssuer {
        paused = _paused;
        emit Paused(_paused);
    }
}
