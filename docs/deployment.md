# Deployment record — Avalanche Fuji

Registro canónico del deploy de la plataforma a Avalanche Fuji (chain 43113, testnet). Este documento es la **fuente de verdad** para las direcciones live + los pasos de reproducción.

> Manifest JSON: [`packages/blockchain/deployments/43113.json`](../packages/blockchain/deployments/43113.json)

## Direcciones live (Avalanche Fuji, chain 43113)

| Contrato            | Address                                      | Snowtrace                                                                               |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `IdentityRegistry`  | `0x8Ca947A8c9714548eCe376a879D6755048018A82` | [link](https://testnet.snowtrace.io/address/0x8Ca947A8c9714548eCe376a879D6755048018A82) |
| `ComplianceManager` | `0x8Db4A89761b208Da299dB9f1979252093A56C45A` | [link](https://testnet.snowtrace.io/address/0x8Db4A89761b208Da299dB9f1979252093A56C45A) |
| `TokenFactory`      | `0x500B3F119E09fA4503f7fE8D5724Ca7776257956` | [link](https://testnet.snowtrace.io/address/0x500B3F119E09fA4503f7fE8D5724Ca7776257956) |
| `Settlement`        | `0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A` | [link](https://testnet.snowtrace.io/address/0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A) |
| `MockUSDC`          | `0x31E5aA694baebF0420170bD9b132F9b5c4b38A83` | [link](https://testnet.snowtrace.io/address/0x31E5aA694baebF0420170bD9b132F9b5c4b38A83) |

**Deployer**: `0x66Cb45eE3646759179901567Fa81Fe2EBa639278` (also `oracle`, `admin`, `matcher`, `fee recipient` para el demo — en producción serían 4 multisigs distintos).

**Demo SecurityToken (ARKDEMO)** desplegado por la `TokenFactory` durante el flow de demo:

| Atributo                                                                                     | Valor                                        |
| -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Address                                                                                      | `0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26` |
| Nombre                                                                                       | Arkangeles Demo Offering                     |
| Símbolo                                                                                      | ARKDEMO                                      |
| Decimales                                                                                    | 18                                           |
| Initial supply                                                                               | 100 ARKDEMO minteados a alice (KYC'd)        |
| Compliance manager                                                                           | `0x8Db4A89...C45A`                           |
| Issuer admin / Agent                                                                         | deployer (`0x66Cb...9278`)                   |
| [Snowtrace](https://testnet.snowtrace.io/address/0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26) |                                              |

## Demo flow on-chain (9 TXs verificables)

Ejecutado por `script/DemoFlow.s.sol` contra Fuji real. Reproducible.

| #   | Acción                                                                                                 | Caller                  | TX hash                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Fund Alice con 0.003 AVAX                                                                              | deployer                | [`0x94a5ff9f...`](https://testnet.snowtrace.io/tx/0x94a5ff9f671d6b9a6f64067844cb2b150b47d0e31df8282c7dc1d0f476b706ae) |
| 2   | Fund Bob con 0.003 AVAX                                                                                | deployer                | [`0xcafa054f...`](https://testnet.snowtrace.io/tx/0xcafa054f85c05b58a9a44be71e43954463b640d2dd02ba667cf7e30ea9776e48) |
| 3   | `IdentityRegistry.verifyAddress(alice)`                                                                | deployer (oracle)       | [`0x06bdaa94...`](https://testnet.snowtrace.io/tx/0x06bdaa9433e89fd265676635de21619d495b78730212aef3614e87a781a26f0b) |
| 4   | `IdentityRegistry.verifyAddress(bob)`                                                                  | deployer (oracle)       | [`0x04d2b986...`](https://testnet.snowtrace.io/tx/0x04d2b9868ab1f4c47fe195be890fb9e80a69acc529d9fe7c8fdfb45354962911) |
| 5   | `MockUSDC.mint(bob, 1000e6)`                                                                           | deployer                | [`0x13862c5a...`](https://testnet.snowtrace.io/tx/0x13862c5abb6721f1c93816f03d9467a633f62e89f0d3278cd584948b416ea24b) |
| 6   | `TokenFactory.deployOffering(...)` — crea ARKDEMO + mintea 100 a alice + handover atómico de roles     | deployer (admin)        | [`0x5de73c89...`](https://testnet.snowtrace.io/tx/0x5de73c892c53923ed1907a1d693613a8e87131078e855919c54100afb8af2777) |
| 7   | `SecurityToken.approve(settlement, max)`                                                               | alice (seller)          | [`0xbd6dbec1...`](https://testnet.snowtrace.io/tx/0xbd6dbec1d3da70cf65e9b4565045a88121159689b9bb26a2dd18154794e61675) |
| 8   | `MockUSDC.approve(settlement, max)`                                                                    | bob (buyer)             | [`0xa14d8693...`](https://testnet.snowtrace.io/tx/0xa14d86939d3ab3541a428ac865ac4018a45fa774c700567fdef5b13df8b5012a) |
| 9   | **`Settlement.executeMatch(...)`** — verifica 2 firmas EIP-712 + ejecuta swap atómico token↔USDC + fee | deployer (MATCHER_ROLE) | [`0x7c9ff553...`](https://testnet.snowtrace.io/tx/0x7c9ff5535304819d523e21d2852cb38cd6a73d691498109c4a12cace35baf5d0) |

### Estado final post-demo

| Cuenta                                     | ARKDEMO | USDC      | Snowtrace                                                                               |
| ------------------------------------------ | ------- | --------- | --------------------------------------------------------------------------------------- |
| Alice (seller) `0x0811...08d9`             | 90.00   | 49.75     | [link](https://testnet.snowtrace.io/address/0x08115fA8e747f1524C32cE1B26B71A8b64B408d9) |
| Bob (buyer) `0x1EA6...b6fd`                | 10.00   | 950.00    | [link](https://testnet.snowtrace.io/address/0x1EA61078e0479Dc83121144A284DD79f5483b6fd) |
| Deployer (fee + remainder) `0x66Cb...9278` | 0       | 10,000.25 | [link](https://testnet.snowtrace.io/address/0x66Cb45eE3646759179901567Fa81Fe2EBa639278) |

**Matemática del trade (verificable on-chain)**:

- Notional: 10 tokens × 5 USDC = 50 USDC
- Fee 0.5% (50 bps): 0.25 USDC → fee recipient
- Seller proceeds: 50 − 0.25 = 49.75 USDC
- Token leg: 10 tokens transferidos (alice 100→90, bob 0→10)
- Payment leg: bob 1000→950 USDC, alice 0→49.75 USDC, deployer +0.25 USDC

## Gas consumido

| Operación            | Gas                                    | Costo (a 2 gwei)         |
| -------------------- | -------------------------------------- | ------------------------ |
| Deploy (5 contratos) | 5,998,744 estimated · 5,103,000 actual | ~0.0102 AVAX             |
| Demo flow (9 TXs)    | ~2,000,000                             | ~0.005 AVAX              |
| **Total sesión**     | ~7M                                    | ~0.015 AVAX (~$0.36 USD) |

Balance restante en deployer wallet: **0.4895 AVAX**.

## Tests Foundry (141, todos verde)

```
Ran 8 test suites in 16ms — 141 tests passed, 0 failed, 0 skipped
```

| Suite                               | Tests                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `IdentityRegistry.t.sol`            | 17 (incluye fuzz `testFuzz_VerifyAndRevoke` 256 runs)                                   |
| `ComplianceManager.t.sol`           | 18 (incluye fuzz `testFuzz_CanTransfer_RespectsBothFlags` 256 runs)                     |
| `SecurityToken.t.sol`               | 29 (mint/burn/freeze/forcedTransfer/pause + hot-swap del compliance manager)            |
| `TokenFactory.t.sol`                | 20 (atomic role handover, no lingering power, enumeración)                              |
| `Settlement.t.sol`                  | 22 (EIP-712, partial fills, replay protection, integración con Pause/Freeze/Compliance) |
| `modules/HoldingPeriodModule.t.sol` | 8                                                                                       |
| `modules/MaxHoldersModule.t.sol`    | 13                                                                                      |
| `modules/JurisdictionModule.t.sol`  | 10                                                                                      |

## Reproducir el deploy desde cero

### Prerequisitos

- [Foundry instalado](https://getfoundry.sh/)
- Una wallet con AVAX testnet en Fuji (faucets: [Chainlink](https://faucets.chain.link/fuji), [Stakely](https://stakely.io/faucet/avalanche-fuji-avax))
- Variables en `.env` del monorepo root: `DEPLOYER_PRIVATE_KEY`, `AVALANCHE_RPC_URL`

### Comandos

```bash
# 1. Instalar deps de Solidity
cd packages/blockchain
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std

# 2. Compilar + correr tests
forge build
forge test                              # 141 tests deben pasar

# 3. Generar wallet ephemeral si no tienes una
cast wallet new

# 4. Verificar balance
cast balance $DEPLOYER_ADDRESS --rpc-url $AVALANCHE_RPC_URL --ether

# 5. Simular deploy (dry-run, sin gastar gas)
forge script script/Deploy.s.sol --rpc-url $AVALANCHE_RPC_URL

# 6. Broadcast real
forge script script/Deploy.s.sol --rpc-url $AVALANCHE_RPC_URL --broadcast --slow

# Tras el deploy:
# - deployments/<chainId>.json contiene el manifest con direcciones
# - deployments/latest.env contiene un snippet listo para copiar al .env del monorepo

# 7. (Opcional) Demo flow end-to-end
# Asegúrate de tener NEXT_PUBLIC_* addresses en .env (copia desde deployments/latest.env)
forge script script/DemoFlow.s.sol --rpc-url $AVALANCHE_RPC_URL --broadcast --slow
```

### Lo que hace `Deploy.s.sol`

Despliega los 5 contratos en orden dependencial:

```
IdentityRegistry(oracle)
    └─ ComplianceManager(admin, registry)
            └─ TokenFactory(admin, compliance)

MockUSDC()  (independiente)

Settlement(admin, matcher, feeRecipient, feeBps=50)
```

Por defecto **todos los roles colapsan al deployer** para conveniencia de testnet. En producción cada uno (oracle, admin, matcher, fee recipient) sería un multisig distinto — overridable vía env: `ORACLE_ADDRESS`, `ADMIN_ADDRESS`, `MATCHER_ADDRESS`, `FEE_RECIPIENT`, `FEE_BPS`.

### Lo que hace `DemoFlow.s.sol`

Ejecuta el ciclo de vida completo on-chain en 9 TXs, contra los contratos previamente deployados (lee addresses desde env `NEXT_PUBLIC_*`):

1. Genera dos wallets ephemeral deterministas (alice `keccak256("arkangeles-demo-alice-seller-v1")`, bob `keccak256("arkangeles-demo-bob-buyer-v1")`).
2. Las fondea con 0.003 AVAX cada una (gas para approve).
3. KYC ambas en `IdentityRegistry`.
4. Mintea 1,000 USDC a bob.
5. `TokenFactory.deployOffering(...)` crea un nuevo SecurityToken (ARKDEMO) con 100 unidades minteadas a alice como supply primario. El factory hace handover atómico: grant agent role → mint → grant admin → renounce su propio admin role.
6. Alice approve Settlement sobre ARKDEMO. Bob approve Settlement sobre USDC.
7. Cada parte firma su Order EIP-712 (10 tokens @ 5 USDC).
8. Deployer (MATCHER_ROLE) llama `Settlement.executeMatch(buy, buySig, sell, sellSig, 10e18)`.
9. Logs muestran balances finales.

## Sincronización con .env del monorepo

Tras el deploy, copia el contenido de `packages/blockchain/deployments/latest.env` al `.env` del monorepo root:

```bash
NEXT_PUBLIC_IDENTITY_REGISTRY=0x8Ca947A8c9714548eCe376a879D6755048018A82
NEXT_PUBLIC_COMPLIANCE_REGISTRY=0x8Db4A89761b208Da299dB9f1979252093A56C45A
NEXT_PUBLIC_TOKEN_FACTORY=0x500B3F119E09fA4503f7fE8D5724Ca7776257956
NEXT_PUBLIC_USDC=0x31E5aA694baebF0420170bD9b132F9b5c4b38A83
NEXT_PUBLIC_SETTLEMENT=0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A
```

Mantén `CHAIN_MODE=mock` por ahora — el backend SDK sigue usando el mock chain mientras se implementa el adapter avalanche real. El frontend lee state live de Fuji directo vía wagmi (`useKycStatus`, `useTokenHolding`).

## Acceso al demo en el frontend

Con el deploy hecho y el `.env` sincronizado, arrancar `pnpm dev`:

1. Abrir `http://localhost:3000`, conectar wallet (Core, MetaMask, etc.)
2. Ir a `/investor` → la card "Estado on-chain · Fuji" lee:
   - `IdentityRegistry.isVerified(tu_wallet)` → "Verificado" / "Pendiente"
   - `MockUSDC.balanceOf(tu_wallet)` → balance USDC formateado
   - `<DemoToken>.balanceOf(tu_wallet)` → balance ARKDEMO con link a Snowtrace

Las lecturas hacen refetch automático cada 30s.

Para ver el caso "con holdings" — importa la deployer key en MetaMask y verás 10,000.25 USDC. O la wallet de alice (`0x08115fA8...08d9`) para ver el caso post-trade (90 ARKDEMO + 49.75 USDC).

## Verificación de source code en Snowtrace / Routescan

**Estado: ✅ los 6 contratos están verificados en Snowtrace testnet.**

| Contrato                  | Verified | Snowscan                                                                             |
| ------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `IdentityRegistry`        | ✅       | https://testnet.snowscan.xyz/address/0x8Ca947A8c9714548eCe376a879D6755048018A82#code |
| `ComplianceManager`       | ✅       | https://testnet.snowscan.xyz/address/0x8Db4A89761b208Da299dB9f1979252093A56C45A#code |
| `TokenFactory`            | ✅       | https://testnet.snowscan.xyz/address/0x500B3F119E09fA4503f7fE8D5724Ca7776257956#code |
| `Settlement`              | ✅       | https://testnet.snowscan.xyz/address/0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A#code |
| `MockUSDC`                | ✅       | https://testnet.snowscan.xyz/address/0x31E5aA694baebF0420170bD9b132F9b5c4b38A83#code |
| `SecurityToken` (ARKDEMO) | ✅       | https://testnet.snowscan.xyz/address/0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26#code |

**API key:** Routescan testnet acepta el placeholder literal `verifyContract` sin signup — ya está en `.env` como `ROUTESCAN_API_KEY=verifyContract`. Para mainnet hay que obtener key real en https://routescan.io.

### Procedimiento reproducible

```powershell
$RPC = "https://api.avax-test.network/ext/bc/C/rpc"
$VERIFIER = "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan"
$KEY = "verifyContract"  # placeholder testnet, no requiere signup
Push-Location packages/blockchain

# 1) IdentityRegistry — constructor(address initialOwner)
forge verify-contract `
  0x8Ca947A8c9714548eCe376a879D6755048018A82 src/IdentityRegistry.sol:IdentityRegistry `
  --chain-id 43113 --verifier-url $VERIFIER --etherscan-api-key $KEY `
  --constructor-args (cast abi-encode "constructor(address)" 0x66Cb45eE3646759179901567Fa81Fe2EBa639278) `
  --watch

# 2) ComplianceManager — constructor(address initialOwner, address registry)
forge verify-contract `
  0x8Db4A89761b208Da299dB9f1979252093A56C45A src/ComplianceManager.sol:ComplianceManager `
  --chain-id 43113 --verifier-url $VERIFIER --etherscan-api-key $KEY `
  --constructor-args (cast abi-encode "constructor(address,address)" `
      0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
      0x8Ca947A8c9714548eCe376a879D6755048018A82) `
  --watch

# 3) TokenFactory — constructor(address initialOwner, address complianceManager)
forge verify-contract `
  0x500B3F119E09fA4503f7fE8D5724Ca7776257956 src/TokenFactory.sol:TokenFactory `
  --chain-id 43113 --verifier-url $VERIFIER --etherscan-api-key $KEY `
  --constructor-args (cast abi-encode "constructor(address,address)" `
      0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
      0x8Db4A89761b208Da299dB9f1979252093A56C45A) `
  --watch

# 4) MockUSDC — constructor()
forge verify-contract `
  0x31E5aA694baebF0420170bD9b132F9b5c4b38A83 src/MockUSDC.sol:MockUSDC `
  --chain-id 43113 --verifier-url $VERIFIER --etherscan-api-key $KEY `
  --watch

# 5) Settlement — constructor(address admin, address matcher, address feeRecipient, uint256 feeBps)
forge verify-contract `
  0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A src/Settlement.sol:Settlement `
  --chain-id 43113 --verifier-url $VERIFIER --etherscan-api-key $KEY `
  --constructor-args (cast abi-encode "constructor(address,address,address,uint256)" `
      0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
      0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
      0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
      50) `
  --watch

# 6) ARKDEMO SecurityToken (hijo de la factory) — constructor(string,string,address,address)
#    El admin pasado al constructor es la FACTORY (no el issuerAdmin final),
#    porque la factory hace el handover atómico de roles después del deploy.
forge verify-contract `
  0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26 src/SecurityToken.sol:SecurityToken `
  --chain-id 43113 --verifier-url $VERIFIER --etherscan-api-key $KEY `
  --constructor-args (cast abi-encode "constructor(string,string,address,address)" `
      "Arkangeles Demo Offering" `
      "ARKDEMO" `
      0x500B3F119E09fA4503f7fE8D5724Ca7776257956 `
      0x8Db4A89761b208Da299dB9f1979252093A56C45A) `
  --watch

Pop-Location
```

Foundry inferirá `viaIR=true`, `optimizer_runs=200`, `solc=0.8.24` desde `foundry.toml`. La verificación demora ~30–60s por contrato. Resultado esperado: `Pass - Verified`.

## Próximos pasos sugeridos

1. **Adapter avalanche real en `packages/sdk`** — reemplazar los mock adapters por lecturas/escrituras vía viem contra las addresses live; el backend matching engine settlearía a chain real.
2. **Módulos pendientes** — `MaxInvestmentModule` (tope por inversionista no calificado) y `ClaimIssuer` (claims firmadas para identidad portable).
3. **`DividendDistributor` + `Governance`** — pilar Idea 2 de la definición (actos corporativos automatizados).
4. **Auditoría formal** (post-hackathon) — recomendado Halborn u OpenZeppelin Audits.

## Notas de seguridad

- La `DEPLOYER_PRIVATE_KEY` actual es una wallet **ephemeral generada solo para este hackathon en testnet**. Nunca debe tocar mainnet. El `.env` que la contiene está gitignored.
- En producción, cada rol (oracle, admin, matcher, fee recipient) debe ser un multisig (Safe) distinto. El parámetro `MAX_FEE_BPS = 500` está hard-coded — un admin comprometido no puede subir el fee arriba del 5%.
- `MockUSDC.mint()` es público para conveniencia testnet — en mainnet usaríamos USDC nativo (`0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` en Avalanche C-Chain) o un Circle deployment.
