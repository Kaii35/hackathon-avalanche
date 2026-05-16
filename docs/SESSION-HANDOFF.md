# SESSION HANDOFF — Mercado Secundario IFC sobre Avalanche

> **Generado:** 2026-05-16 al final de la primera sesión.
> **Actualizado:** 2026-05-16 (sesión 2 — Sumsub real, wallet linking real, admin investor view real, landing polish, build verde).
> **Para retomar:** pega este documento entero al inicio de un nuevo chat de Claude Code, o usa el "READY-TO-PASTE CONTINUATION PROMPT" del final.
> **Repo:** https://github.com/Kaii35/hackathon-avalanche
> **Branch:** `main` (working tree limpio; último commit `6173f08` pushed — Sumsub KYC + wallet linking + admin investors + landing polish).

---

# 1. PROJECT OVERVIEW

## Qué estamos construyendo

Plataforma white-label de **tokenización + mercado secundario regulado** para participaciones de Instituciones de Financiamiento Colectivo (IFC) en México, sobre Avalanche, con compliance CNBV embebido a nivel smart contract.

**Cliente piloto:** Arkangeles (IFC regulada CNBV operando equity crowdfunding).
**Hackathon:** Avalanche LATAM 2026.
**Diferencial:** un DEX genérico no puede operar como secundario regulado en México porque no enforza jurisdicción / accreditation a nivel protocolo. Nosotros sí, vía ERC-3643 + módulos compliance enchufables.

## Objetivo del producto

Resolver iliquidez del inversionista IFC (hoy 5–10 años atrapado sin poder vender). Construir:

1. Capa on-chain: security tokens ERC-3643 con identity registry + módulos de compliance evolucionables.
2. Capa de datos: Postgres + Redis + indexer event-driven que mirror el state on-chain.
3. Capa backend: KYC orchestrator + matching engine off-chain (EIP-712) + RBAC + audit log.
4. Capa frontend: 3 portales — investor, issuer IFC, compliance admin.

## Estado actual del MVP

**Producción-ready (live):**

- Smart contracts ERC-3643 desplegados en Avalanche Fuji (chain 43113)
- 141 tests Foundry, 8 suites, 100% verde, 16ms
- Demo flow end-to-end ejecutado on-chain (9 TXs verificables en Snowtrace)
- Auth real (login/register/logout/session/profile) con bcrypt + JWT httpOnly
- **Registro con confirmar contraseña** (cross-field Zod refine)
- DB schema migrada (Supabase) + seed
- **SDK avalanche adapter implementado** (`packages/sdk/src/blockchain/avalanche/`) — 5 adapters viem-based; `CHAIN_MODE=avalanche` arranca sin throw, lecturas reales validadas contra Fuji (`isVerified`, `getFee`, `balanceOf` ok). `executeMatch` cablea full Order tuples + signatures EIP-712 al `Settlement` deployado. Schema EIP-712 del SDK arreglado para incluir `paymentToken` + domain `ArkangelesSettlement` (match al contrato).
- **UI signing + approve flow end-to-end** (Bloque A paso 2 cerrado) — `PlaceOrderPanel` firma órdenes via wagmi `signTypedData` contra el `Settlement` real; nuevo `ApproveSettlementButton` que lee allowance en vivo y aprueba `approve(settlement, maxUint256)` cuando es insuficiente. Banner KYC informativo. Toast con link a Snowscan al aprobar. La UI de orderbook usa polling real cada 5s contra `/api/orders/book/:id`.
- **Unidad reconciliada end-to-end** — el frontend computa base units con `parseUnits(qty, 18)` y `parseUnits(price, 6)` solo para firmar; envía pretty units + signature al backend; `order.service.ts` y `matching.service.ts` re-derivan base units con la misma fórmula y pasan al adapter ya escaladas; `AvalancheSettlement` es pass-through. El digest que firma el wallet coincide exactamente con el que el contrato verifica → `recover()` funciona y `executeMatch` queda settleable.
- **Offering ARKDEMO sembrada en DB** (`00000000-0000-4000-8000-000000000001`) apuntando al token real `0x1C18933B…0C26` en Fuji. Endpoint `/api/offerings/<id>` responde con la oferta real.
- **Smoke test on-chain del SDK adapter exitoso** — TX [`0x9f77e768…39d46`](https://testnet.snowscan.xyz/tx/0x9f77e768c232b3b830577164bb89153e6750cfce31f47d5a2cdcd1b952d39d46) en bloque 55432032: alice firma sell de 5 ARKDEMO @ 4 USDC, bob firma buy de 5 ARKDEMO @ 4.50 USDC, el SDK via `IfcMarketClient.settlement.executeMatch` settlea atómicamente — Transfer ARKDEMO + Transfer USDC + Fee + `TradeExecuted` event. Status `1`, gasUsed 175k. Es el mismo path que toma el matching engine del backend → prueba que el loop completo está funcional.
- **Bug fix en los 4 adapters avalanche** — `wc.getAddresses()` devuelve `Address[]` (strings), causando que viem use `eth_sendTransaction` (RPC-signing, no soportado en nodos públicos). Cambiado a `wc.account` (LocalAccount object) en `AvalancheSettlement`, `AvalancheIdentityRegistry`, `AvalancheComplianceRegistry`, `AvalancheSecurityToken`. Sin este fix, ninguna escritura on-chain funcionaba desde el SDK.
- **`DividendDistributor` Idea 2 — primer pilar de actos corporativos cerrado** — contrato push-allocation + pull-claim deployado en Fuji `0x71dA4E2cbc181F7eE9936c7A8243566fDcAb93c6`, source verified en Snowscan. 17 tests Foundry verde (158 totales, 0 regresiones). Smoke test on-chain ejecutado: deployer declara dividendo de 20 USDC a alice (85% = 17) + bob (15% = 3); ambos hacen pull-claim exitoso; balances finales correctos; contrato queda con 0 USDC sin fondos atrapados. TX declare [`0x0faa80ee…1cf7499c`](https://testnet.snowscan.xyz/tx/0x0faa80ee498d06a4c40883d164ddfc1f96836a29e5dd5184245cc1151cf7499c). El contrato delega autorización al `DEFAULT_ADMIN_ROLE` del `SecurityToken` (no tiene Ownable propio); el issuer admin de cada oferta es quien declara.
- **`Governance` Idea 2 — segundo pilar cerrado** — contrato propose + weighted vote + finalize deployado en Fuji `0xfd2619c9d7b36c32309e613065bc0fd4f71e5f6d`, source verified en Snowscan. 25 tests Foundry verde (183 totales, 0 regresiones). Mismo patrón que `DividendDistributor`: push-allocation snapshot al proponer, pull-vote por holder. Outcomes declarativos (Passed/Defeated/Tie), sin ejecución on-chain — el issuer ejecuta la decisión off-chain (drag-along, dividendo, cambio estatutario). Smoke test on-chain: deployer propone "Aprobar dividendo Q1 2026" a alice (peso 85) + bob (peso 15) con deadline +180s; alice vota For, bob vota Against; tras deadline, deployer llama `finalize(0)` → `ProposalFinalized(0, Passed, 85, 15, 0)`. TX propose [`0xb8f92bc9…b8d83b16`](https://testnet.snowscan.xyz/tx/0xb8f92bc91964c1b099f027f5b93f8f373c5760e033cecd9dee22d3e9b8d83b16), finalize [`0x0d5064db…305b242b`](https://testnet.snowscan.xyz/tx/0x0d5064db1e35211843394b0d35619fbb793d3c57580ac1e9ceae5471305b242b).
- **Fixes runtime descubiertos en QA manual del usuario** (puramente client-side, errores que el monitor de logs no captura porque ocurren en el error boundary de React):
  - `useOfferings` recibía respuesta paginada `{ items, total, page, pageSize }` del API real pero el tipo era `MockOffering[]`. Causaba `(intermediate value).slice is not a function` al renderizar el dashboard tras login. Fix en [apps/web/src/lib/client/queries/offerings.ts](apps/web/src/lib/client/queries/offerings.ts): el hook ahora hace `Array.isArray(raw) ? raw : raw?.items ?? []` y aplica filtro de status post-fetch como defensa.
  - `OfferingCard` accedía a `offering.trend7d.at(-1)` pero el API real no devuelve campos UI-only (`trend7d`, `holders`, `lastTradePrice`, `thumbnailColor`, `pricingHistory`, `documents`, `fundedPct`, `volume24h`). Causaba `Cannot read properties of undefined (reading 'at')`. Fix con helper `enrichOffering()` en el mismo archivo del hook — rellena defaults seguros (`trend7d: [0,0,0,0,0,0,0]`, `holders: 0`, `lastTradePrice ?? pricePerUnit`, etc.) antes de que la respuesta llegue a cualquier componente.
- **UX wallet ↔ sesión sincronizado** (request del usuario en QA: "la wallet no debería conectarse antes de iniciar sesión"):
  - `useLogout` ahora llama `disconnect()` de wagmi además de limpiar la sesión → al cerrar sesión, la wallet también se desconecta limpiamente (no queda stale en localStorage).
  - Nuevo componente cliente `<DisconnectWalletOnAuth />` ([apps/web/src/components/auth/DisconnectWalletOnAuth.tsx](apps/web/src/components/auth/DisconnectWalletOnAuth.tsx)) incluido en el layout `(auth)` → si el usuario cae en `/login` o `/register` con una wallet stale auto-reconectada, se desconecta en mount. Garantiza que la wallet solo esté conectada con sesión activa.
- Indexer event-driven mock-compat (sigue listening Redis Streams, sin cambios en este pase)
- 22 endpoints API con validación + RBAC + rate limiting
- Wallet integration (Core priorizada, MetaMask, Coinbase, Rabby, Injected)
- Modal RainbowKit con tema brand-tinted (radii, shadows, group labels, brand glow)
- Frontend reads live de Fuji vía wagmi (`useKycStatus`, `useTokenHolding`, `OnChainStatusCard`)
- ~30 páginas frontend
- Light/dark theme, hero animado (GSAP), loading screen (Three.js)
- **Logout con shader farewell + redirect a landing** (4s hold, mirrors login UX)

**Real on-chain integrations (sesión 2):**

- Holdings IFC en dashboard (derivados de wallet, no son los tokens reales todavía — solo el demo ARKDEMO sí es real)
- ~~Orderbook animado (timer-based)~~ — ahora hace polling real cada 5s contra `/api/orders/book/:id`
- **Sumsub KYC sandbox integrado end-to-end**: token endpoint, polling endpoint, webhook endpoint (HMAC SHA256/SHA512/SHA1), WebSDK widget en `/onboarding/kyc`
- **Real SIWE-like wallet linking**: `POST /api/users/me/wallet` con verificación de firma (recoverMessageAddress de viem), case-insensitive matching, anti-replay con `Issued At` timestamp ±10 min
- **On-chain `IdentityRegistry.verifyAddress` real**: `lib/server/chain/identityRegistry.ts` con viem directo a Fuji (bypassea el adapter avalanche del SDK que sigue tirando throw), idempotente (lee `isVerified` antes de escribir)
- **Admin investor view con data real**: `GET /api/admin/investors` agrega User + primary Wallet + última Identity + último KycRecord + suma de notional de trades. Auto-reconcile de pending Sumsub records (batched 5x Promise.allSettled, throttle 15s in-process)
- **Admin jurisdictions con globo 3D Cobe** (WebGL) en lugar del SVG estático

**Mock/placeholder (UI ok, sin lógica real todavía):**

- Holdings IFC en dashboard (derivados de wallet, no son los tokens reales — solo el demo ARKDEMO sí es real)
- Orderbook animado (timer-based)
- Distribución de dividendos

**Pendiente:**

- ~~Snowtrace contract verification~~ — COMPLETADO (6/6 contratos verified, ver `docs/deployment.md`)
- ~~Adapter avalanche real en `packages/sdk`~~ — COMPLETADO (ver sección 9 y "Deuda técnica" abajo)
- ~~UI frontend para firma EIP-712 + orderbook visible~~ — COMPLETADO (Bloque A paso 2). Loop user→sign→match→settle reconciliable; falta smoke test on-chain con 2 wallets reales que termine en un TX exitoso en Snowtrace
- ~~KYC provider real~~ ✅ Sumsub sandbox integrado
- ~~Real SIWE wallet linking~~ ✅
- ~~Admin investor data real desde DB~~ ✅
- Snowtrace contract verification
- Adapter avalanche real en `packages/sdk` (reemplaza mock backend → matching on-chain)
- Módulos compliance: `MaxInvestmentModule`, `ClaimIssuer`
- ~~Contrato Idea 2: `DividendDistributor`~~ — DEPLOYADO + verified + smoke-tested
- ~~Contrato Idea 2: `Governance`~~ — DEPLOYADO + verified + smoke-tested
- ~~UI dividendos~~ — COMPLETADA (Bloque B paso 8 + 9)
- UI Idea 2 pendiente: Governance (issuer crear propuesta + investor votar)
- Auditoría formal post-hackathon (Halborn/OZ)
- Workers BullMQ persistentes
- WalletConnect mobile (necesita Reown project ID)
- **Vercel deploy** para URL fija de webhook Sumsub (cloudflare quick tunnels son efímeras)
- Pitch deck + video demo
- AvaCloud subnet (producción)
- Sandbox CNBV

**Deuda técnica identificada (avalanche adapter):**

- `freeze/unfreeze sin token param`: La interfaz `SecurityTokenAdapter.freeze(wallet, reason)` no incluye el `token` address porque fue diseñada para el mock (freeze global). En `SecurityToken.sol`, freeze es per-token (`freezeWallet` en el contrato del token específico). Fix: refactorizar `SecurityTokenAdapter` para incluir `token?: Address` en freeze/unfreeze, o agregar un método separado `freezeForToken(token, wallet, reason)`. El endpoint `/api/admin/freeze` debe pasar el token address directamente al contrato, no via el adapter genérico.

- `Compliance modules no se bindean en deploy`: `TokenFactory.deployOffering` no bindea `HoldingPeriodModule`, `MaxHoldersModule`, ni `JurisdictionModule` por defecto. El adapter `AvalancheSecurityToken.deploy` ignora `lockupUntil`, `maxHolders`, `allowedJurisdictions`. Fix: agregar llamadas `ComplianceManager.bindModule` post-deploy en el adapter, o crear un flujo separado de "attach modules".

- `transfer holder-signed no soportado server-side`: `AvalancheSecurityToken.transfer` lanza error explicativo. Para el secundario regulado esto es correcto (el Settlement contract hace la transferencia via `safeTransferFrom` con pre-aprobación del holder). No es deuda — es by-design.

- ~~`Qty/price scaling inconsistente`~~ — COMPLETADO (ver sección "Convención EIP-712" abajo).

## Convención EIP-712 + unidades (acordada frontend ↔ backend)

**Esta es la única fuente de verdad. No se puede cambiar sin actualizar ambas capas.**

- `CreateOrderDto.qty` y `CreateOrderDto.price` son strings **pretty** (e.g. `"100"`, `"5.50"`).
- El frontend calcula base units antes de firmar:
  - `qtyBaseUnits  = parseUnits(qty, 18)` (token 18 decimales)
  - `priceBaseUnits = parseUnits(price, 6)` (USDC 6 decimales)
- El payload EIP-712 firmado por el wallet contiene `qty: qtyBaseUnits` y `price: priceBaseUnits`.
- El frontend envía al POST `/api/orders` los valores **pretty + firma**; NO envía base units.
- El backend re-deriva base units con la misma fórmula y verifica la firma (digest idéntico).
- DB guarda valores **pretty** (Decimal(38,18)).
- `matching.service.ts` re-deriva base units con `parseUnits` antes de construir los tuples de Settlement.
- `AvalancheSettlement.ts` es pass-through: recibe base units, las pasa directamente al contrato.

## Offering ARKDEMO (token real en Fuji)

- **Offering ID:** `00000000-0000-4000-8000-000000000001`
- **Token address:** `0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26`
- **Symbol:** ARKDEMO
- **Chain:** Avalanche Fuji (43113)
- El frontend debe usar este ID para enlazar el orderbook y el portfolio ARKDEMO.

---

# 2. SYSTEM ARCHITECTURE

## Vista de alto nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 15)                     │
│  Investor Portal  │  Issuer Portal  │  Compliance Admin Panel   │
│  + wagmi/viem hooks que leen LIVE de Fuji directo                │
└────────────┬───────────────┬────────────────────┬───────────────┘
             │               │                    │
             ▼               ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js / Next.js API Routes)          │
│  KYC Orchestrator │ Order Matching │ Indexer │ Audit Log         │
│  (todavía usa MOCK chain SDK; adapter avalanche real pendiente)  │
└────────────┬───────────────┬────────────────────┬───────────────┘
             │               │                    │
       ┌─────▼─────┐   ┌─────▼─────┐       ┌─────▼─────┐
       │ Supabase  │   │  Upstash  │       │  Pinata   │
       │ (Postgres)│   │ (Redis +  │       │  (IPFS,   │
       │           │   │ Streams)  │       │ planeado) │
       └───────────┘   └───────────┘       └───────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AVALANCHE FUJI (chain 43113) — LIVE                 │
│  IdentityRegistry │ ComplianceManager (+ 3 módulos) │ Settlement │
│  TokenFactory │ SecurityToken (1 demo deployed) │ MockUSDC       │
└─────────────────────────────────────────────────────────────────┘
```

## Diseño on-chain / off-chain

**Off-chain (matching):**

- Orderbook en Postgres + Redis Sorted Sets
- Cada orden firmada EIP-712 sobre el `Order` struct del Settlement contract
- Matching engine en backend cruza órdenes y construye la TX de settlement
- Razón: orderbook 100% on-chain es caro/lento; este patrón da UX de exchange tradicional

**On-chain (settlement):**

- `Settlement.executeMatch(buy, buySig, sell, sellSig, fillQty)` ejecuta atómicamente:
  1. Verifica 2 firmas EIP-712 (recover signer == maker)
  2. Valida side, token mismatch, expiration, price cross
  3. Updatea `filled[hash]` (anti-replay + partial fills)
  4. `safeTransferFrom` token seller→buyer (esto invoca compliance via `SecurityToken._update`)
  5. `safeTransferFrom` USDC buyer→seller (minus fee)
  6. `safeTransferFrom` fee → feeRecipient (si feeBps > 0)
  7. Emite `TradeExecuted`

Si CUALQUIER paso falla → revert completo, cero half-state.

## Relación frontend/backend/blockchain

| Capa                     | Lee de                                              | Escribe a                                          |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------- |
| Frontend (wagmi/viem)    | Fuji directo (balances, KYC status, token holdings) | Wallet del user firma; settlement TX via backend   |
| Backend (Next.js API)    | Postgres + Redis + mock chain SDK                   | Postgres + Redis + (futuro) chain real via adapter |
| Indexer (Node.js worker) | Redis Streams (mock chain events)                   | Postgres (cap_table, trades)                       |
| Smart contracts (Fuji)   | Identity + Compliance + balances on-chain           | Eventos emitidos para el indexer                   |

**Configuración crítica actual del .env:**

- `CHAIN_MODE=avalanche` (cambiado por user post-HANDOFF v1) — **PERO** el adapter avalanche del SDK sigue tirando throw, así que las rutas que usan `chainClient.*` retornan 500 (`/api/offerings` por ejemplo). Mi código nuevo (Sumsub, on-chain verify) bypassea el SDK usando viem directo, así que funciona independiente.
- `NEXT_PUBLIC_USE_MOCKS=false` — frontend prefiere APIs reales, fallback a mocks solo en 404/501
- `NEXT_PUBLIC_*` contract addresses → live Fuji
- **`SUMSUB_*` configurado** (sandbox): `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_LEVEL_NAME=basic-kyc-level`, `SUMSUB_WEBHOOK_SECRET`. Credenciales reales están en `.env` (gitignored); `.env.example` tiene placeholders.

> ⚠️ Si retomas y necesitas re-configurar Sumsub desde cero: ver sección 16 (Sumsub setup).

---

# 3. BLOCKCHAIN STACK

## Red usada

**Avalanche Fuji testnet** (chain 43113) actualmente. **Production target: subnet propia en AvaCloud** (validadores Arkangeles + partners, gas en stablecoin, permissioned a nivel protocolo).

## Avalanche configuration

| Setting             | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| Chain name          | Avalanche Fuji C-Chain                                  |
| Chain ID            | **43113**                                               |
| RPC URL             | `https://api.avax-test.network/ext/bc/C/rpc`            |
| Explorer            | `https://testnet.snowtrace.io`                          |
| Routescan API       | `https://api.routescan.io/v2/network/testnet/evm/43113` |
| Native token        | AVAX (18 decimals)                                      |
| Gas price observado | ~2.0 gwei                                               |

## Avalanche CLI setup

**NO instalado** en esta sesión (no fue necesario — usamos Foundry directo contra el RPC público). Existe un `install.sh` en root y en `packages/blockchain/` que es el installer de avalanche-cli (no nuestro código; ambos están **gitignored**).

## Wallet setup

**Deployer wallet (ephemeral, testnet only)** generada vía `cast wallet new`:

```
Address:     0x66Cb45eE3646759179901567Fa81Fe2EBa639278
Private key: 0xd7a2cb800d73531482ebdb7caa5abddaf503210f908491d3d0b9f798b77b9c43
```

Esta key:

- Está en `.env` del monorepo root (gitignored, nunca tocó git)
- **Nunca debe usarse en mainnet** — Claude la generó durante la sesión
- Colapsa 4 roles en testnet: deployer, oracle (KYC), admin, matcher (Settlement), fee recipient. En producción serían 4 multisigs distintos.
- Balance actual: ~0.4895 AVAX (después de deploy + demo flow)

**Funding usado:** faucet sin cupón (Chainlink u otros) — el faucet oficial de Avalanche requería código que el user no tenía.

## Deployment assumptions

- El deployer tiene `MATCHER_ROLE` en Settlement (puede llamar `executeMatch` directamente).
- El deployer es owner del `IdentityRegistry` (única autoridad KYC oracle).
- El deployer es owner del `ComplianceManager` (puede bindear/unbindear módulos por token).
- El deployer es owner de cada módulo (puede configurar lockup, max holders, jurisdicciones permitidas).
- El deployer es `DEFAULT_ADMIN_ROLE` del Settlement (puede ajustar feeBps + feeRecipient hasta MAX_FEE_BPS=500).
- El **demo SecurityToken ARKDEMO** fue deployado vía `TokenFactory.deployOffering(...)`. Tras el deploy, la factory **renunció** su DEFAULT_ADMIN_ROLE; ahora solo el deployer (issuerAdmin del demo) tiene esos roles + AGENT_ROLE.

---

# 4. SMART CONTRACT ARCHITECTURE

Todos en `packages/blockchain/src/` y `packages/blockchain/src/modules/`. Pragma `0.8.24`. OZ v5.6.1. viaIR habilitado.

## 4.1 IdentityRegistry.sol

- **Responsabilidad:** Mapping wallet → KYC verificado. Única autoridad: oracle (owner).
- **Estado:** ✅ deployado en Fuji `0x8Ca947A8c9714548eCe376a879D6755048018A82`
- **Funciones:**
  - `verifyAddress(address user)` — onlyOwner. Marca como verificado. Revert si ya estaba.
  - `revokeAddress(address user)` — onlyOwner. Revoca.
  - `batchVerifyAddresses(address[] calldata users)` — onlyOwner. **Idempotente** (skip duplicados, no revert).
  - `isVerified(address user) → bool` — public view.
- **Storage:** `mapping(address => bool) private _verified`
- **Dependencias:** `Ownable` (OZ v5)
- **Eventos:** `AddressVerified(user, verifier)`, `AddressRevoked(user, verifier)`
- **Custom errors:** `ZeroAddress`, `AlreadyVerified(user)`, `NotVerified(user)`
- **Access control:** Owner único = oracle KYC backend. En prod sería multisig.
- **Security considerations:**
  - `ZeroAddress` check antes de cualquier write.
  - `batchVerify` es idempotente para que el oracle pueda reintentar sin revertir el batch completo.

## 4.2 ComplianceManager.sol

- **Responsabilidad:** Bilateral KYC + lista per-token de módulos compliance. Llamado en cada `SecurityToken._update`.
- **Estado:** ✅ deployado en Fuji `0x8Db4A89761b208Da299dB9f1979252093A56C45A`
- **Funciones:**
  - `bindModule(address token, address module)` — onlyOwner
  - `unbindModule(address token, address module)` — onlyOwner. Itera array para encontrar + swap-and-pop.
  - `setIdentityRegistry(address newRegistry)` — onlyOwner
  - `canTransfer(address from, address to, uint256 amount) → bool` — **view**, iterado en cada transfer del SecurityToken. Hace:
    1. Bilateral KYC vs IdentityRegistry (skip si address(0) — mint/burn)
    2. Itera `_modules[msg.sender]` (msg.sender = el SecurityToken llamante) y consulta `canTransfer(token, from, to, amount)` en cada módulo
  - `moduleAction(address from, address to, uint256 amount)` — state-changing. Itera módulos. **Llamado por el SecurityToken después de `super._update`**.
  - `modulesOf(address token) → address[]` — public view
- **Storage:**
  - `IIdentityRegistry public identityRegistry`
  - `mapping(address => IComplianceModule[]) private _modules`
  - `mapping(address => mapping(address => bool)) public isModuleBound`
- **Dependencias:** `Ownable`, interfaz `IIdentityRegistry`, interfaz `IComplianceModule`
- **Eventos:** `IdentityRegistryUpdated`, `ModuleBound`, `ModuleUnbound`
- **Custom errors:** `ZeroAddress`, `ModuleAlreadyBound(token, module)`, `ModuleNotBound(token, module)`
- **Access control:** Owner único = admin (en testnet = deployer).
- **Decisión clave:** Módulos están **scoped por `msg.sender`** (el SecurityToken que pregunta). Una sola deployment de cada módulo sirve a todas las ofertas.

## 4.3 modules/IComplianceModule.sol (interface)

- **Responsabilidad:** Surface común de los módulos compliance.
- **Estado:** ✅
- **Interfaz:**
  ```solidity
  interface IComplianceModule {
    function canTransfer(
      address token,
      address from,
      address to,
      uint256 amount
    ) external view returns (bool);
    function moduleAction(address token, address from, address to, uint256 amount) external;
  }
  ```

## 4.4 modules/HoldingPeriodModule.sol

- **Responsabilidad:** Bloquea transferencias secundarias antes del lockup configurado. Mints siempre permitidos.
- **Estado:** ✅ código + tests (8). No deployado por defecto — `bindModule` en demand.
- **Funciones:**
  - `setLockup(address token, uint256 lockupUntil_)` — onlyOwner
  - `canTransfer(token, from, to, amount) → bool` — view. Si `from == address(0)` (mint) → true. Else `block.timestamp >= lockupUntil[token]`.
  - `moduleAction(...)` — no-op (verifica `msg.sender == complianceManager`)
- **Storage:** `mapping(address => uint256) public lockupUntil`, `address public immutable complianceManager`
- **Dependencias:** `Ownable`, `IComplianceModule`
- **Eventos:** `LockupSet(token, lockupUntil)`
- **Access control:** Ownable. ComplianceManager address pinned al deploy (immutable).

## 4.5 modules/MaxHoldersModule.sol

- **Responsabilidad:** Cap por token del número de holders únicos concurrentes (regla CNBV).
- **Estado:** ✅ código + tests (13). No deployado por defecto.
- **Funciones:**
  - `setMaxHolders(address token, uint256 max)` — onlyOwner. max=0 = unlimited.
  - `canTransfer(token, from, to, amount) → bool` — view. Si `to == 0` o ya holder → true. Else `holderCount[token] + 1 <= cap`.
  - `moduleAction(token, from, to, amount)` — `onlyCompliance`. Updates `isHolder` + `holderCount` mirando `IERC20.balanceOf` post-transfer.
- **Storage:** `maxHolders[token]`, `holderCount[token]`, `isHolder[token][wallet]`
- **Custom errors:** `OnlyCompliance`
- **Eventos:** `MaxHoldersSet`, `HolderAdded`, `HolderRemoved`
- **Decisión clave:** Mappings desnormalizados (`isHolder + holderCount`) para O(1) check; iterar todos los holders sería DoS.

## 4.6 modules/JurisdictionModule.sol

- **Responsabilidad:** Allowlist por país (ISO 3166-1 numeric) por token.
- **Estado:** ✅ código + tests (10). No deployado por defecto.
- **Funciones:**
  - `setJurisdiction(address user, uint16 code)` — onlyRole(ORACLE_ROLE)
  - `setJurisdictionAllowed(address token, uint16 code, bool allowed)` — onlyRole(DEFAULT_ADMIN_ROLE)
  - `canTransfer(token, from, to, amount) → bool` — view. Si `to == 0` → true (burn). Else `isJurisdictionAllowed[token][jurisdictionOf[to]]`.
  - `moduleAction(...)` — no-op (verifica `msg.sender == complianceManager`)
- **Storage:** `jurisdictionOf[user]`, `isJurisdictionAllowed[token][code]`
- **Dependencias:** `AccessControl`, `IComplianceModule`
- **Access control:** **Split de roles**:
  - `ORACLE_ROLE` = backend KYC (declara jurisdicción del user, en sync con KYC)
  - `DEFAULT_ADMIN_ROLE` = admin (abre/cierra países por token)
- **Convención:** MX = 484, US = 840, BR = 76 (ISO 3166-1 numeric)
- **Decisión clave:** Diferenciamos quién declara jurisdicción del usuario (oracle) vs quién decide qué países pueden holdear cada token (admin). Es separation of duties regulatoria.

## 4.7 SecurityToken.sol

- **Responsabilidad:** ERC-20 institucional. Toda movimiento pasa por compliance + freeze + pause.
- **Estado:** ✅ código + tests (29). **Una instancia demo** deployada vía factory: ARKDEMO `0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26`.
- **Funciones:**
  - **Admin:** `mint(to, amount)`, `setComplianceManager(newManager)`, `pause()`, `unpause()`, grant/revoke roles
  - **Holder:** `burn(amount)` (burns own balance), standard `transfer`/`approve`/`transferFrom`
  - **Agent (compliance):** `freezeWallet(addr)`, `unfreezeWallet(addr)`, `forcedTransfer(from, to, amount)`
- **Storage:**
  - `IComplianceManager public complianceManager`
  - `mapping(address => bool) public frozen`
  - `bool private _forcedTransferContext` (transient flag)
- **Dependencias:** OZ `ERC20`, `AccessControl`, `Pausable`. Interfaz `IComplianceManager` inline.
- **Eventos:** `ComplianceManagerUpdated`, `WalletFrozenSet`, `WalletUnfrozenSet`, `ForcedTransferExecuted`
- **Custom errors:** `ZeroAddress`, `WalletFrozen(wallet)`, `ComplianceCheckFailed(from, to)`, `AlreadyFrozen`, `NotFrozen`
- **Access control (AccessControl, NO Ownable):**
  - `DEFAULT_ADMIN_ROLE` = issuer (mintea, pausa, swap compliance, grant agentes)
  - `AGENT_ROLE` = compliance officer (freeze, forcedTransfer)
- **Hook único `_update` (single gate):**
  1. `whenNotPaused` modifier
  2. Si NO es forcedTransfer → check `frozen[from]`
  3. Always check `frozen[to]`
  4. `complianceManager.canTransfer(from, to, value)` — revert con `ComplianceCheckFailed`
  5. `super._update(from, to, value)` — balance change + Transfer event
  6. `complianceManager.moduleAction(from, to, value)` — state updates de módulos
- **Forced transfer logic:**
  - Bypass freeze sobre `from` (recovery de wallet congelada)
  - **Mantiene** freeze sobre `to`, compliance, pause
  - Flag transitorio `_forcedTransferContext` se setea/limpia alrededor del `_transfer`
  - Test verificó que el flag se limpia (no persiste entre calls)

## 4.8 TokenFactory.sol

- **Responsabilidad:** Deployer canónico de SecurityTokens. Atomic role handover.
- **Estado:** ✅ deployado en Fuji `0x500B3F119E09fA4503f7fE8D5724Ca7776257956`
- **Funciones:**
  - `deployOffering(bytes32 offeringId, string name, string symbol, address issuerAdmin, address complianceAgent, uint256 initialSupply, address initialRecipient) → address` — onlyOwner
  - `setComplianceManager(address newManager)` — onlyOwner. **Solo aplica a futuras ofertas**; las pre-existentes conservan su propia referencia.
  - `offeringsCount() → uint256`, `allOfferings() → address[]`, `offeringAt(i) → address`, `offerings(bytes32) → address`
- **Flujo atómico del `deployOffering`:**
  1. Deploya `SecurityToken` con factory como temporary admin
  2. Grant `AGENT_ROLE` al `complianceAgent`
  3. Si `initialSupply > 0`, factory mintea a `initialRecipient` (compliance se aplica)
  4. Grant `DEFAULT_ADMIN_ROLE` al `issuerAdmin`
  5. `renounceRole(DEFAULT_ADMIN_ROLE, address(this))` — **factory queda sin poder residual**
  6. Indexa el offering
- **Storage:** `address public complianceManager`, `mapping(bytes32 => address) public offerings`, `address[] private _allOfferings`
- **Dependencias:** `Ownable`
- **Eventos:** `ComplianceManagerUpdated`, `OfferingDeployed(offeringId, token, issuerAdmin, complianceAgent, name, symbol, initialSupply, initialRecipient)`
- **Custom errors:** `ZeroAddress`, `InvalidOfferingId`, `OfferingAlreadyExists(offeringId)`
- **Decisión clave:** `offeringId` = `keccak256(backendUuid)` para colision-resistance y dedupe.
- **Decisión clave:** El renounce final garantiza que un hackeo de la factory NO compromete tokens ya emitidos.

## 4.9 Settlement.sol

- **Responsabilidad:** Atomic swap token↔USDC con verificación EIP-712. Sin custodia (usa approvals).
- **Estado:** ✅ deployado en Fuji `0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A`
- **Funciones:**
  - `executeMatch(buy, buySig, sell, sellSig, fillQty)` — onlyRole(MATCHER_ROLE), nonReentrant
  - `cancelOrder(order)` — solo el maker (`msg.sender == order.maker`). Idempotente.
  - `setFee(uint256 newBps, address newRecipient)` — onlyRole(DEFAULT_ADMIN_ROLE)
  - `hashOrder(order) → bytes32` — public view (EIP-712 digest)
  - `domainSeparator() → bytes32` — public view
- **EIP-712 Order schema:**
  ```solidity
  enum Side { Buy, Sell }
  struct Order {
      address maker;
      address token;          // SecurityToken
      address paymentToken;   // USDC
      Side side;
      uint256 qty;            // base units del token (18 decimales)
      uint256 price;          // base units paymentToken POR 1 token entero (10^18 base units)
      uint256 expiresAt;
      uint256 salt;
  }
  bytes32 public constant ORDER_TYPEHASH = keccak256(
      "Order(address maker,address token,address paymentToken,uint8 side,uint256 qty,uint256 price,uint256 expiresAt,uint256 salt)"
  );
  ```
- **Domain:** `EIP712("ArkangelesSettlement", "1")`
- **Pricing convention:** `price` = USDC base units por 1 token whole unit. Si token tiene 18 decimales y USDC 6, `price = 10_000_000` = 10 USDC/share. Fórmula: `paymentAmount = (fillQty * price) / 1e18`.
- **Execution price:** **Seller's ask** (maker pricing). Si bid > ask, buyer captura el spread improvement.
- **Storage:**
  - `mapping(bytes32 => uint256) public filled` (anti-replay + partial fills)
  - `mapping(bytes32 => bool) public cancelled`
  - `uint256 public feeBps` (50 actualmente = 0.5%)
  - `address public feeRecipient`
- **Constants:** `BPS_DENOMINATOR = 10_000`, `MAX_FEE_BPS = 500` (5% hard cap)
- **Dependencias:** OZ `EIP712`, `ECDSA`, `AccessControl`, `ReentrancyGuard`, `IERC20`, `SafeERC20`
- **Eventos:** `TradeExecuted(buyOrderHash, sellOrderHash, buyer, seller, token, paymentToken, fillQty, executionPrice, paymentAmount, fee)`, `OrderCancelled`, `FeeUpdated`
- **Custom errors:** `ZeroAddress`, `FeeTooHigh`, `WrongSide`, `TokenMismatch`, `PaymentTokenMismatch`, `OrderExpired`, `PriceCrossInvalid`, `InvalidBuySignature`, `InvalidSellSignature`, `OrderAlreadyCancelled(hash)`, `InvalidFillQty`, `NotMaker`
- **Access control:**
  - `DEFAULT_ADMIN_ROLE` (deployer) — puede ajustar fee
  - `MATCHER_ROLE` (deployer) — puede llamar `executeMatch`
- **Security considerations:**
  - `nonReentrant` + CEI: `filled` se actualiza ANTES de los `safeTransferFrom`
  - Hard fee cap del 5% en `MAX_FEE_BPS` — admin comprometido no puede vampirizar
  - Sin custodia (usa approvals) — si el contrato es hackeado no hay tokens que robar; usuarios revocan allowances
  - Token leg dispara `SecurityToken._update` → compliance enforced atómicamente
- **Decisión clave:** Matcher centralizado vía `MATCHER_ROLE`. Las órdenes EIP-712 son públicas pero solo el matcher autorizado puede settlearlas — mitiga MEV/frontrunning vs orderbook 100% on-chain.

## 4.10 MockUSDC.sol

- **Responsabilidad:** ERC-20 testnet (6 decimales, mint público).
- **Estado:** ✅ deployado en Fuji `0x31E5aA694baebF0420170bD9b132F9b5c4b38A83`
- **Funciones:** `mint(to, amount)` público, `decimals() → 6`
- **Dependencias:** OZ `ERC20`
- **⚠️ NUNCA deployar en mainnet** — mint público.

## 4.B KYC / Identity stack (Sumsub + on-chain reconciliation) — sesión 2

Reemplaza al KYC mock. Vive **off-chain** principalmente, con un trigger on-chain `IdentityRegistry.verifyAddress(wallet)` cuando KYC=verified Y wallet linked.

### Componentes nuevos

| Archivo                                                 | Responsabilidad                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/server/services/sumsub.service.ts`    | Cliente Sumsub firmado (HMAC-SHA256 sobre `ts + METHOD + path?query + body`). Expone `ensureApplicant`, `generateAccessToken`, `verifyWebhook` (soporta SHA256/SHA512/SHA1)                                                              |
| `apps/web/src/app/api/kyc/sumsub/token/route.ts`        | `POST` autenticado. Crea applicant (idempotente por userId), upserts `KycRecord` con `provider='sumsub'`, devuelve token WebSDK (~10 min TTL)                                                                                            |
| `apps/web/src/app/api/kyc/sumsub/status/route.ts`       | `GET` autenticado. Polling para reconciliar. Si Sumsub devuelve `GREEN`, llama `chainVerifyAddress` + upserts `Identity` + audit log con tx hash                                                                                         |
| `apps/web/src/app/api/kyc/sumsub/webhook/route.ts`      | `POST` público. Verifica HMAC del raw body con header `x-payload-digest`. Reconcilia `KycRecord` + `Identity` + on-chain. Maneja eventos `applicantReviewed`, `applicantPending`, `applicantOnHold`, `applicantCreated`                  |
| `apps/web/src/lib/server/chain/identityRegistry.ts`     | Helper viem directo a `IdentityRegistry` en Fuji. **Bypassea el SDK avalanche roto.** Idempotente (lee `isVerified` antes de escribir). Falla silenciosa con `{skipped: true}` si faltan vars de entorno                                 |
| `apps/web/src/app/(onboarding)/onboarding/kyc/page.tsx` | Reemplaza los fake uploaders por el WebSDK widget de Sumsub (`@sumsub/websdk-react`). Maneja 7 estados (idle/loading/ready/pending/verified/rejected/error), polling al status endpoint cada 4s en `pending`, theme-aware (`useTheme()`) |

### Flujo end-to-end (cuando todo está en línea)

```
User en /onboarding/kyc
    │
    ├─ Click "Iniciar verificación"
    │     ▼
    ├─ POST /api/kyc/sumsub/token ──► Sumsub: ensureApplicant + accessToken (10 min)
    │     ▲                          ◄── { token, applicantId }
    │     │
    │     └─ DB: KycRecord upsert {provider=sumsub, status=pending, externalId=applicantId}
    │
    ├─ <SumsubWebSdk accessToken={token} ...> monta iframe
    │     │
    │     User completa verificación (sandbox: cualquier docu test funciona)
    │     │
    │     │ events: idCheck.onApplicantSubmitted → state=pending
    │     │
    │     ▼
    └─ Front polea /api/kyc/sumsub/status cada 4s
              │
              ▼
       Sumsub fires webhook  ─────► POST /api/kyc/sumsub/webhook
              │ (paralelo)                │
              │                           ├─ Verify HMAC (rawBody, x-payload-digest)
              │                           ├─ Update KycRecord.status
              │                           ├─ If verified + wallet linked:
              │                           │    ├─ chainVerifyAddress(wallet) → IdentityRegistry on Fuji
              │                           │    └─ upsert Identity row
              │                           └─ Audit log
              │
              ▼
       /api/kyc/sumsub/status (polling)
              │
              ├─ Read applicant state from Sumsub
              ├─ Mirror to DB (KycRecord, Identity)
              └─ Return current status
```

### Reconciliación pasiva en admin

Si el webhook NO llega (tunnel down, URL desactualizada, etc.), `GET /api/admin/investors` actúa como **safety net**:

- Lista usuarios con `KycRecord.status='pending'` (provider=sumsub)
- Por cada uno, fetch a Sumsub via `getApplicantByExternalId`
- Si Sumsub dice GREEN/RED, actualiza DB + dispara on-chain
- **Batched 5 en paralelo** (`Promise.allSettled`) para latencia baja
- **Throttle 15s in-process** para no martillar Sumsub si admin recarga rápido

Combinado con el polling del frontend, **el webhook es opcional** para que la app funcione. El webhook solo da real-time push; sin él, el sistema converge via polling.

### Tipos de cuenta y wallets reales (sesión 2)

| User                     | Role     | Wallet primaria                              | KYC status |
| ------------------------ | -------- | -------------------------------------------- | ---------- |
| `migue714.mg@gmail.com`  | admin    | `0xa24f1a1afb5ca441554633b750923e6e6eef7dd9` | pending    |
| `josemg.714@hotmail.com` | investor | `0x5f5300...2abb`                            | pending    |
| 5× seed `*.example.mx`   | investor | (random hex)                                 | verified   |

## Webhook tunnel — estado actual

- **Cloudflared instalado vía winget**: `C:/Users/USER/AppData/Local/Microsoft/WinGet/Packages/Cloudflare.cloudflared_*/cloudflared.exe`
- **Quick Tunnel** (efímero): `cloudflared tunnel --url http://localhost:3000` → URL random `*.trycloudflare.com`
- **Limitación**: la URL cambia en cada reinicio del proceso → hay que actualizar el campo "Objetivo" en Sumsub
- **Solución persistente recomendada para equipo** (no implementada aún): **deploy a Vercel** con URL fija `https://hackathon-avalanche-*.vercel.app/api/kyc/sumsub/webhook`. Steps detallados en sección 12 (próximos pasos).

## Contratos pendientes

| Contrato              | Razón                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `MaxInvestmentModule` | Tope inversión per-investor no calificado (CNBV) — pendiente                                 |
| `ClaimIssuer`         | Claims firmadas externas para identidad portable entre IFCs — pendiente                      |
| `OrderBook` on-chain  | No necesario — matching es off-chain con EIP-712, cancelación on-chain ya está en Settlement |
| `Escrow`              | No necesario — settlement es atómico, no T+1                                                 |

---

# 5. REPOSITORY STRUCTURE

```
hackathon-avalanche/
├── README.md                          # Pitch + addresses live + quickstart
├── ARCHITECTURE.md                    # Diseño técnico completo (actualizado a stack real)
├── CLAUDE.md                          # Convenciones internas + hard rules (no tocar sin razón)
├── .env                               # Secrets + addresses (GITIGNORED)
├── .env.example                       # Template público
├── apps/
│   ├── web/                           # Next.js 15 (App Router, Turbopack)
│   │   ├── next.config.ts             # outputFileTracingRoot pinned a monorepo root (sesión 2)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (app)/investor/page.tsx          # Inyecta OnChainStatusCard
│   │   │   │   ├── (app)/admin/investors/page.tsx   # Data real (sesión 2)
│   │   │   │   ├── (app)/admin/compliance/jurisdictions/page.tsx  # Globo 3D Cobe (sesión 2)
│   │   │   │   ├── (auth)/register/page.tsx         # + Confirmar contraseña (sesión 2)
│   │   │   │   ├── (onboarding)/onboarding/kyc/page.tsx    # SumsubWebSdk widget (sesión 2)
│   │   │   │   ├── (onboarding)/onboarding/wallet/page.tsx # SIWE real (sesión 2)
│   │   │   │   └── api/
│   │   │   │       ├── admin/investors/route.ts     # NEW - data real + reconcile (sesión 2)
│   │   │   │       └── kyc/sumsub/
│   │   │   │           ├── token/route.ts           # NEW (sesión 2)
│   │   │   │           ├── status/route.ts          # NEW (sesión 2)
│   │   │   │           └── webhook/route.ts         # NEW HMAC-verified (sesión 2)
│   │   │   ├── components/
│   │   │   │   ├── dashboard/OnChainStatusCard.tsx
│   │   │   │   ├── landing/
│   │   │   │   │   ├── Compliance.tsx               # Bento grid (sesión 2)
│   │   │   │   │   ├── CtaBackgroundPaths.tsx       # NEW animated CTA (sesión 2)
│   │   │   │   │   └── HowItWorks.tsx               # ASCII ellipsis fix (sesión 2)
│   │   │   │   ├── loading/DashboardLoadingScreen.tsx  # + footnote/ariaLabel props (sesión 2)
│   │   │   │   ├── shell/Sidebar.tsx                # Longest-prefix-wins + optimistic (sesión 2)
│   │   │   │   ├── shell/Topbar.tsx                 # Logout shader + mounted gate (sesión 2)
│   │   │   │   ├── ui/cobe-globe-cdn.tsx            # NEW 3D globe theme-aware (sesión 2)
│   │   │   │   └── wallet/ConnectWalletPrompt.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useKycStatus.ts
│   │   │   │   ├── useTokenHolding.ts
│   │   │   │   ├── useWallet.ts
│   │   │   │   ├── useWalletBalances.ts
│   │   │   │   └── useFujiActivity.ts
│   │   │   ├── lib/
│   │   │   │   ├── client/
│   │   │   │   │   ├── contracts.ts
│   │   │   │   │   ├── api.ts
│   │   │   │   │   ├── wagmi.ts
│   │   │   │   │   ├── mocks/admin.ts               # MockInvestor.wallet ahora nullable (sesión 2)
│   │   │   │   │   └── queries/admin.ts             # Handles wrapped audit-log response (sesión 2)
│   │   │   │   └── server/
│   │   │   │       ├── chain/
│   │   │   │       │   ├── client.ts                # IfcMarketClient (mock)
│   │   │   │       │   └── identityRegistry.ts      # NEW viem direct caller (sesión 2)
│   │   │   │       ├── middleware/withErrorHandler.ts  # AnyCtx fix (sesión 2)
│   │   │   │       └── services/
│   │   │   │           ├── auth.service.ts          # linkWallet case-insensitive fix (sesión 2)
│   │   │   │           ├── order.service.ts
│   │   │   │           └── sumsub.service.ts        # NEW signed API client (sesión 2)
│   │   │   └── providers/Web3Provider.tsx           # RainbowKit theme overrides (sesión 2)
│   │   └── package.json                             # + @sumsub/websdk-react, cobe (sesión 2)
│   └── indexer/                       # Worker Node.js (event-driven, ESM)
│       └── package.json               # MODIFIED: dotenv-cli prefix on dev/start
├── packages/
│   ├── blockchain/                    # ✅ Foundry project — TODOS los contratos viven aquí
│   │   ├── foundry.toml               # solc=0.8.24, viaIR=true, optimizer_runs=200
│   │   ├── remappings.txt             # @openzeppelin → lib/openzeppelin-contracts/
│   │   ├── .gitignore                 # IGNORA lib/, deployments/31337.json, deployments/latest.env
│   │   ├── src/
│   │   │   ├── IdentityRegistry.sol
│   │   │   ├── ComplianceManager.sol
│   │   │   ├── SecurityToken.sol
│   │   │   ├── TokenFactory.sol
│   │   │   ├── Settlement.sol
│   │   │   ├── MockUSDC.sol
│   │   │   └── modules/
│   │   │       ├── IComplianceModule.sol
│   │   │       ├── HoldingPeriodModule.sol
│   │   │       ├── MaxHoldersModule.sol
│   │   │       └── JurisdictionModule.sol
│   │   ├── test/                      # 141 tests Foundry
│   │   │   ├── IdentityRegistry.t.sol     # 17 tests
│   │   │   ├── ComplianceManager.t.sol    # 18 tests
│   │   │   ├── SecurityToken.t.sol        # 29 tests
│   │   │   ├── TokenFactory.t.sol         # 20 tests
│   │   │   ├── Settlement.t.sol           # 22 tests
│   │   │   └── modules/
│   │   │       ├── HoldingPeriodModule.t.sol  # 8 tests
│   │   │       ├── MaxHoldersModule.t.sol     # 13 tests
│   │   │       └── JurisdictionModule.t.sol   # 10 tests
│   │   ├── script/
│   │   │   ├── Deploy.s.sol           # Deploya los 5 contratos en orden
│   │   │   └── DemoFlow.s.sol         # End-to-end demo flow (9 TXs)
│   │   ├── deployments/
│   │   │   ├── .gitkeep
│   │   │   └── 43113.json             # Manifest canónico de Fuji
│   │   ├── broadcast/                 # Records de TXs reales (commiteados, no dry-runs)
│   │   │   ├── Deploy.s.sol/43113/run-latest.json
│   │   │   └── DemoFlow.s.sol/43113/run-latest.json
│   │   └── lib/                       # GITIGNORED - run `forge install` después de clone
│   │       ├── openzeppelin-contracts/  # v5.6.1
│   │       └── forge-std/
│   ├── sdk/                           # @hack/sdk
│   │   └── src/
│   │       ├── client.ts              # IfcMarketClient (mock mode; 'avalanche' lanza throw)
│   │       ├── eip712.ts              # ORDER_TYPE schema (sync con Settlement.sol futuro)
│   │       ├── blockchain/
│   │       │   ├── interfaces/        # Adapter interfaces
│   │       │   └── mock/              # 5 mock adapters
│   │       └── events/                # EventBus tipado + Redis Streams
│   ├── shared/                        # Zod schemas, DTOs, AppError, constantes
│   ├── ui/                            # @hack/ui — 35+ componentes shadcn/Radix
│   └── database/                      # Prisma schema (11 modelos) + migrations + seed
├── docs/
│   ├── compliance-flow.md             # ACTUALIZADO - arquitectura modular completa
│   ├── trading-flow.md                # ACTUALIZADO - EIP-712 schema + demo TX
│   ├── regulatory-notes.md            # CNBV / Ley Fintech
│   ├── deployment.md                  # NEW - manifest canónico + reproduce steps
│   ├── BRIEF-PARA-DOCUMENTAR.md       # Actualizado
│   ├── DOSSIER-DOCUMENTACION.md       # Actualizado
│   ├── GUIA-DOCUMENTACION.md
│   └── SESSION-HANDOFF.md             # ESTE ARCHIVO
└── .claude/                           # Agents + skills (no commiteado: settings.local.json)
```

---

# 6. TECH STACK

## Frontend (apps/web)

- **Next.js 15** (App Router, Turbopack)
- **React 19**
- **TypeScript** estricto (`noUncheckedIndexedAccess`)
- **Tailwind CSS 3.4** + tokens semánticos (light/dark)
- **shadcn/ui** + Radix UI primitives
- **wagmi v2** + **viem v2** + **RainbowKit 2** (Core wallet prioritized)
- **Framer Motion 11** (transitions, theme toggle, CTA letter animation)
- **GSAP** (hero canvas animations)
- **Three.js** (loading screen shader)
- **cobe** ← NEW (sesión 2) — WebGL 3D globe en admin/jurisdictions
- **@sumsub/websdk-react** ← NEW (sesión 2) — iframe widget de KYC
- **TanStack Query v5** (data fetching + cache)
- **TanStack Table v8** (DataTable)
- **React Hook Form 7** + Zod resolvers (con `.refine` cross-field para confirmar contraseña)
- **Zustand 5** (estado cliente persistido)
- **Recharts 2** (charts)
- **lucide-react** (iconos, incluyendo `Lock` para items disabled)
- **cmdk** (⌘K palette)
- **date-fns 4** (locale es)
- **Sonner** (toasts)
- **next-themes**

## Backend (apps/web/src/app/api + apps/web/src/lib/server)

- **Node.js 20**
- **Next.js Route Handlers** (Promise-based params, Next 15 signature)
- **Prisma ORM 5** + **PostgreSQL 16** (Supabase hosted)
- **Redis 7** (Upstash hosted, TLS) — Streams + Sorted Sets + sliding window rate limit
- **BullMQ 5** (queues)
- **ioredis**
- **jose** (JWT HS256 + cookie httpOnly)
- **bcryptjs**
- **pino + pino-pretty** (con PII redaction)
- **viem** (server-side EIP-712 verification + SIWE-like)
- **Zod**
- **dotenv-cli**

## Indexer (apps/indexer)

- **Node.js 20 ESM**
- **tsx** (runtime + watch)
- **ioredis** (consumer groups en Redis Streams)
- **pino**
- **@prisma/client**

## Smart contracts (packages/blockchain) — Foundry-native

- **Solidity 0.8.24** (viaIR, optimizer_runs=200)
- **Foundry** (forge + cast + anvil)
- **forge-std** (testing helpers, vm.sign, vm.warp, etc.)
- **OpenZeppelin contracts v5.6.1**:
  - Ownable, AccessControl
  - ERC20, ERC20 (IERC20, IERC20Metadata)
  - Pausable
  - EIP712, ECDSA
  - ReentrancyGuard
  - SafeERC20
- **Pragma alignment:** OZ v5.6 transitively requires `^0.8.24` via MessageHashUtils, Strings, Bytes — por eso bumpeamos de 0.8.20 a 0.8.24 al inicio del Settlement (era requisito).

## Infraestructura / DevOps

- **pnpm 10** (workspaces)
- **Turborepo 2** (pipelines)
- **Husky** + **lint-staged** (pre-commit prettier+eslint)
- **ESLint 9** + **Prettier 3**

## Servicios externos

- **Supabase** (Postgres hosted, free tier) — connection string en .env
- **Upstash** (Redis Streams hosted, free tier, TLS)
- **Routescan / Snowtrace API** (lectura de TXs Fuji, sin API key)
- **Avalanche Fuji RPC** (público): `https://api.avax-test.network/ext/bc/C/rpc`
- **Pinata** (IPFS, planeado pero no implementado)
- **Reown / WalletConnect Cloud** (opcional, mobile QR — no configurado todavía)

---

# 7. DEPENDENCIES INSTALLED

## packages/blockchain

- `openzeppelin-contracts` v5.6.1 — via `forge install` (en lib/, gitignored)
- `forge-std` (latest) — via `forge install` (en lib/, gitignored)
- **Tras clone, correr:** `forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std`

## apps/web

Todo ya estaba instalado pre-sesión. Hooks nuevos (`useKycStatus`, `useTokenHolding`, `OnChainStatusCard`) usan SOLO dependencies existentes (`wagmi`, `viem`, `lucide-react`, `@hack/ui`).

## apps/indexer

`apps/indexer/package.json` modificado para añadir prefix `dotenv -e ../../.env --` en scripts `dev` y `start` (lee el .env del monorepo root).

## Pendientes

- Avalanche adapter para SDK (no instalado nuevas deps; usaría wagmi/viem que ya están)
- ROUTESCAN_API_KEY (opcional, para `forge verify-contract`) — no obtenido

---

# 8. COMMANDS USED

## Setup desde cero (tras clone fresco)

```bash
pnpm install

# Smart contracts deps
cd packages/blockchain
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std

# Tests
forge test                          # 141 tests, ~16ms

# Volver a root
cd ../..

# Si no usas Supabase/Upstash hosted:
docker compose up -d                # Postgres + Redis locales

# Dev (web + indexer)
pnpm dev
```

## Generar wallet ephemeral (testnet only)

```powershell
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "1"
cast wallet new
# Devuelve address + private key. Guardar en .env como DEPLOYER_PRIVATE_KEY + DEPLOYER_ADDRESS.
```

## Verificar balance en Fuji

```powershell
cast balance 0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc --ether
```

## Deploy a Fuji

```powershell
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "1"
$env:DEPLOYER_PRIVATE_KEY = "0xd7a2cb800d73531482ebdb7caa5abddaf503210f908491d3d0b9f798b77b9c43"
$env:AVALANCHE_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
Push-Location packages/blockchain

# Dry-run (simulación, no gasta gas)
forge script script/Deploy.s.sol --rpc-url $env:AVALANCHE_RPC_URL

# Broadcast real (gasta gas)
forge script script/Deploy.s.sol --rpc-url $env:AVALANCHE_RPC_URL --broadcast --slow

Pop-Location
# Resultado: deployments/43113.json + deployments/latest.env generados
```

## Demo flow on-chain (después del deploy)

```powershell
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "1"
$env:DEPLOYER_PRIVATE_KEY = "..."
$env:AVALANCHE_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
$env:NEXT_PUBLIC_IDENTITY_REGISTRY = "0x8Ca947A8c9714548eCe376a879D6755048018A82"
$env:NEXT_PUBLIC_TOKEN_FACTORY = "0x500B3F119E09fA4503f7fE8D5724Ca7776257956"
$env:NEXT_PUBLIC_SETTLEMENT = "0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A"
$env:NEXT_PUBLIC_USDC = "0x31E5aA694baebF0420170bD9b132F9b5c4b38A83"

Push-Location packages/blockchain
forge script script/DemoFlow.s.sol --rpc-url $env:AVALANCHE_RPC_URL --broadcast --slow -vvv
Pop-Location
```

## Smoke test reads contra contratos vivos

```powershell
$RPC = "https://api.avax-test.network/ext/bc/C/rpc"

# Verifica owner del IdentityRegistry
cast call 0x8Ca947A8c9714548eCe376a879D6755048018A82 "owner()(address)" --rpc-url $RPC

# Verifica que un wallet esté KYC'd
cast call 0x8Ca947A8c9714548eCe376a879D6755048018A82 `
  "isVerified(address)(bool)" 0x66Cb45eE3646759179901567Fa81Fe2EBa639278 --rpc-url $RPC

# Balance USDC
cast call 0x31E5aA694baebF0420170bD9b132F9b5c4b38A83 `
  "balanceOf(address)(uint256)" 0x66Cb45eE3646759179901567Fa81Fe2EBa639278 --rpc-url $RPC
```

## TXs reales escritas durante la sesión

```powershell
# KYC al deployer (manual smoke test, no automatizado en DemoFlow)
cast send 0x8Ca947A8c9714548eCe376a879D6755048018A82 `
  "verifyAddress(address)" 0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
  --private-key $env:DEPLOYER_PRIVATE_KEY --rpc-url $RPC

# Mint USDC al deployer
cast send 0x31E5aA694baebF0420170bD9b132F9b5c4b38A83 `
  "mint(address,uint256)" 0x66Cb45eE3646759179901567Fa81Fe2EBa639278 10000000000 `
  --private-key $env:DEPLOYER_PRIVATE_KEY --rpc-url $RPC
```

## Frontend type-check

```powershell
Push-Location apps/web
pnpm type-check  # nota: script se llama 'type-check', NO 'typecheck'
Pop-Location
```

**Errores pre-existentes** (unrelated): 3 Zod v3/v4 mismatches en `profile/page.tsx`, `login/page.tsx`, `register/page.tsx`. NO bloquean.

## Git

```bash
# Estado actual
git log --oneline -3
# 7f5652d docs: reflect Fuji deploy + Foundry migration + modular compliance
# f77586d feat(blockchain): ERC-3643 core deployed to Avalanche Fuji + frontend live reads
# d53143c feat: arkangeles brand, light/dark theme, hero canvas, auth gates

# Push pending
git status --short  # debe estar limpio excepto .claude/settings.local.json (gitignored OK)
```

---

# 9. IMPLEMENTATION DECISIONS

Lista de decisiones técnicas YA TOMADAS. **No cambiar sin justificación explícita** — cada una tiene rationale documentado abajo.

## Smart contracts

| Decisión                                                                                       | Razón                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Solidity 0.8.24 (no 0.8.20)**                                                                | OZ v5.6.1 requiere transitivamente ^0.8.24 (MessageHashUtils, Strings, Bytes). User pidió 0.8.20 inicialmente pero la dep transitiva forzó el bump. Consistente con CLAUDE.md que dice 0.8.24.                                                   |
| **Foundry (no Hardhat)**                                                                       | Tests 10x más rápidos (16ms para 141 tests vs minutos en Hardhat). Integración nativa con `vm.sign` para EIP-712. Workflow más cercano al chain. Trade-off: menos integración TS, mitigado porque deploy/demo scripts son `.sol` self-contained. |
| **OpenZeppelin v5.6.1**                                                                        | Latest estable. Patrón `Ownable(initialOwner)` constructor explícito (v5 breaking change vs v4).                                                                                                                                                 |
| **ERC-3643 inspired (no ERC-1404)**                                                            | Identity registry separado del token, módulos compliance evolucionables sin redeploy. ERC-1404 más limitado. ERC-1400 menos adopción.                                                                                                            |
| **Custom errors en lugar de require strings**                                                  | Gas más cheap, typed para integración off-chain (selectors estables).                                                                                                                                                                            |
| **AccessControl en SecurityToken + Settlement (no Ownable)**                                   | Múltiples roles (issuer vs agent compliance officer; admin vs matcher). Permite delegar sin colusión.                                                                                                                                            |
| **Ownable en IdentityRegistry + ComplianceManager + Modules (no AccessControl)**               | Una sola autoridad (oracle KYC o admin). Simplicidad. Cambiar a AccessControl si necesitamos roles separados después.                                                                                                                            |
| **Split de roles en JurisdictionModule**                                                       | DEFAULT_ADMIN_ROLE (abre/cierra países por token) ≠ ORACLE_ROLE (declara jurisdicción del usuario, sync con KYC). Separation of duties.                                                                                                          |
| **Módulos scoped por `msg.sender` (el SecurityToken llamante)**                                | Una sola deployment de cada módulo sirve a todas las ofertas. Estado per-token vivido en mappings `mapping(address token => ...)`.                                                                                                               |
| **Mint/burn skip compliance del lado address(0)**                                              | Issuer puede mintear durante lockup; quemar nunca requiere KYC del destinatario inexistente. Alineado con ERC-3643.                                                                                                                              |
| **Forced transfer bypassa freeze de `from` pero MANTIENE compliance + pause + freeze de `to`** | Recovery = mover fondos fuera de wallet congelada (key loss, court order). No debe permitir lavar a wallet sancionada ni hacia no-KYC.                                                                                                           |
| **Pause es TOTAL (incluye forced transfer)**                                                   | Emergency stop regulatoria gana. Si CNBV dice "todo se detiene", también recovery.                                                                                                                                                               |
| **Transient flag `_forcedTransferContext`**                                                    | Implementación del bypass de freeze. Se setea ANTES de `_transfer`, se limpia DESPUÉS. Test verifica que no persiste entre calls.                                                                                                                |
| **Single `_update` gate en SecurityToken**                                                     | OZ v5 unifica mint/burn/transfer en `_update`. Sobreescribir ahí garantiza que NO existe forma de mover tokens sin pasar por compliance — defensa contra futuros helpers accidentales.                                                           |
| **TokenFactory hace `renounceRole(DEFAULT_ADMIN_ROLE, address(this))`**                        | Zero residual power. Hackeo de la factory NO compromete tokens ya emitidos.                                                                                                                                                                      |
| **`offeringId = keccak256(backendUuid)` (bytes32)**                                            | Backend tiene UUIDs; keccak da collision resistance + dedupe on-chain sin storage extra.                                                                                                                                                         |
| **Settlement.executeMatch tiene MATCHER_ROLE (no permissionless)**                             | En mercado regulado, el platform controla quién settles. Las órdenes están firmadas, pero solo el matcher autorizado las empuja.                                                                                                                 |
| **EIP-712 con domain `("ArkangelesSettlement", "1")`**                                         | Domain separator depende de chainId + address(Settlement) automáticamente → previene replay cross-chain y cross-deployment.                                                                                                                      |
| **Pricing convention: price = USDC base units POR 1 token entero**                             | Convención: token=18 decimales, payment=6 decimales, price=10_000_000 significa 10 USDC/share. Fórmula: `payment = (fillQty * price) / 1e18`.                                                                                                    |
| **Execution price = seller's ask (maker pricing)**                                             | Patrón estándar de exchanges. Si bid > ask, buyer captura "spread improvement". Alineado con regulación (no permite matcher inflar precio).                                                                                                      |
| **Hard cap MAX_FEE_BPS = 500 (5%)**                                                            | Defense in depth: admin comprometido no puede vampirizar usuarios. Hard-coded como `constant`, no setteable.                                                                                                                                     |
| **Settlement sin custodia (usa approvals)**                                                    | Si el contrato es hackeado, no hay tokens que robar; usuarios revocan allowances.                                                                                                                                                                |
| **`nonReentrant` + CEI en executeMatch**                                                       | `filled[hash] += fillQty` ANTES de los `safeTransferFrom`. Defense in depth aunque el flujo es trusted.                                                                                                                                          |
| **Cancelación on-chain idempotente**                                                           | `cancelOrder(order)` no revierte si ya estaba cancelada. Patrón documentado en trading-flow.md.                                                                                                                                                  |
| **MockUSDC con `decimals() = 6`**                                                              | Match con USDC real para que la convención de pricing y la integración futura sean indistinguibles.                                                                                                                                              |
| **MockUSDC con mint público**                                                                  | Solo testnet. NUNCA mainnet. Documentado con comentario `@notice ... DO NOT deploy to mainnet`.                                                                                                                                                  |

## Frontend

| Decisión                                                               | Razón                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend lee live de Fuji directo vía wagmi (no SDK adapter)**       | El adapter avalanche del SDK no está implementado (lanza throw). El frontend usa `useReadContract` con las addresses + ABIs minimales para leer KYC status, balances, etc. directamente.                           |
| **CHAIN_MODE=mock (backend) + NEXT_PUBLIC_USE_MOCKS=false (frontend)** | Híbrido pragmático: backend matching engine sigue en mock (sin afectar ya implementado), frontend visualiza state real on-chain. Razón: implementar avalanche adapter completo era mucho trabajo para esta sesión. |
| **ABIs minimales en `contracts.ts` (no JSON completo)**                | Solo las 5 funciones view necesarias (`isVerified`, `balanceOf`, `symbol`, `decimals`, `name`). Mantiene el bundle ligero.                                                                                         |
| **`FUJI_DEMO_TOKEN` constante hardcoded en `contracts.ts`**            | El frontend no tiene UI para enumerar ofertas todavía. Mientras tanto, el demo ARKDEMO sirve para mostrar el card "estado on-chain".                                                                               |
| **`refetchInterval: 30_000` en `useReadContract`**                     | Refresca cada 30s. Suficiente para demo, conservador con RPC público.                                                                                                                                              |
| **`OnChainStatusCard` solo se monta si hay wallet conectada**          | Patrón consistent con `ConnectWalletPrompt` (gating existente).                                                                                                                                                    |
| **Idioma:** Strings user-facing en español (rule del proyecto)         | Spanish first per CLAUDE.md. Code/comments en inglés OK.                                                                                                                                                           |

## Backend / SDK

| Decisión                                     | Razón                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **SDK mode `avalanche` lanza throw**         | Adapter real no implementado. Cambio a 'avalanche' rompe el backend. Por eso `.env` tiene `CHAIN_MODE=mock`. |
| **`apiOrMock` fallback solo en 404/501**     | Frontend prefiere APIs reales; cae a mock únicamente si endpoint no existe.                                  |
| **dotenv-cli prefix en scripts del indexer** | Indexer lee `.env` del monorepo root, no del propio package.                                                 |

## Infra / DevOps

| Decisión                                                              | Razón                                                                                                     |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`lib/` de Foundry en `.gitignore`**                                 | 16MB de OZ + forge-std. Re-instalable con `forge install`. Documentado en commit message.                 |
| **`deployments/31337.json` (local sim) y `latest.env` gitignored**    | Solo `43113.json` (Fuji real) commiteado como manifest.                                                   |
| **`broadcast/Deploy.s.sol/43113/run-latest.json` commiteado**         | Record permanente de las TXs reales del demo.                                                             |
| **`install.sh` en .gitignore root**                                   | Es el installer de avalanche-cli (no nuestro código).                                                     |
| **`packages/blockchain/.git` (creado por `forge install`) eliminado** | Bloqueaba `git add` por verse como submódulo nested.                                                      |
| **No usé git submodules para OZ**                                     | `forge install --no-commit` no setup gitlinks. Simplicidad: .gitignore lib/ + `forge install` post-clone. |

## Decisiones de sesión 2 (Sumsub + wallet linking + admin)

| Decisión                                                                            | Razón                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sumsub sandbox como KYC provider**                                                | Self-serve signup, webhooks HMAC-signed que matchean nuestro schema, level configurable, soporta INE/CURP/CFE (docs MX). Truora/Mati eran candidatos pero requerían sales call.                                                                                                  |
| **Helper viem directo a IdentityRegistry (`lib/server/chain/identityRegistry.ts`)** | El SDK avalanche del proyecto tira throw porque el adapter no está implementado. Mi código nuevo necesitaba escribir on-chain → uso viem directo. Idempotente (lee `isVerified` antes). Falla silenciosa si faltan vars (returns `{skipped: true}`) — KYC no se rompe por chain. |
| **Reconcile en `/api/admin/investors`**                                             | Defensa en profundidad: si el webhook NO llega (tunnel down, URL stale), el admin endpoint sincroniza pending records cada vez que el admin abre la página. Self-healing.                                                                                                        |
| **Batch + throttle del reconcile**                                                  | `Promise.allSettled` batches de 5 + throttle in-process 15s. Sin esto, una recarga rápida del admin haría N fetches paralelos a Sumsub. Con esto, hasta 5 paralelos y skip si ya reconciliamos hace <15s.                                                                        |
| **Polling cada 4s en `/onboarding/kyc`**                                            | Fallback primario al webhook. Mientras el user está en la página, polling es real-time. Si webhook llega antes, polling solo observa el state ya escrito. Si webhook NO llega, polling es la única vía de update.                                                                |
| **`KycRecord` es source of truth, `Identity` es mirror on-chain**                   | El admin endpoint prioriza `KycRecord.status` (Sumsub) sobre `Identity.kycStatus` (on-chain). Si están desincronizados (e.g. tx on-chain falló), admin ve el verdict real de Sumsub.                                                                                             |
| **`Identity.claimHash` derivado del KycRecord.id**                                  | El schema requiere `claimHash` (32-byte hex). Hasta tener un `ClaimIssuer` real, derivamos deterministicamente: `0x + hex(KycRecord.id) padded a 64 chars`. Trazable hacia atrás desde el audit log.                                                                             |
| **SIWE-like message format propio (no ERC-4361 estricto)**                          | El message incluye `mercado-ifc.local` (`SIWE_DOMAIN`), la wallet, URI, Chain ID 43113, e `Issued At`. Backend valida vía: `recoverMessageAddress` viem + match address (case-insensitive) + freshness check (±10 min via `Issued At`).                                          |
| **Case-insensitive address match en `linkWallet`**                                  | Zod transform lowercasea `address`, pero el message lleva checksum (mixed-case). El check `message.includes(address)` falla. Fix: `message.toLowerCase().includes(address)` (address ya está lower).                                                                             |
| **Cobe globe theme-aware**                                                          | El componente CDN tiene colores hardcoded en light. Lo hice theme-aware con `useTheme()` interno + `isDark` en el dep array del effect → re-init del globo al cambiar theme. Mantiene `baseColor` blanco en ambos modes pero ajusta `glowColor`, `dark`, `diffuse`, `opacity`.   |
| **Browser-extension hydration warnings → `suppressHydrationWarning` en `<body>`**   | Grammarly inyecta `data-new-gr-c-s-check-loaded` antes de hidratar. Equivalente al patrón ya existente en `<html>` para next-themes.                                                                                                                                             |
| **Mounted gate para UI wallet-dependent (Topbar, onboarding/wallet)**               | `useAccount()` de wagmi devuelve `isConnected=false` en SSR y rehidrata `true` en client → mismatch. Patrón: `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);` y gate la UI condicional.                                                   |
| **`withErrorHandler` ctx tipo `{ params: Promise<...> }` (sin `\| undefined`)**     | Next 15 generated route types rechazan el shape `\| undefined` con error en build. El ctx siempre es definido en runtime.                                                                                                                                                        |
| **Confirmar contraseña: form-only, no en `RegisterDto`**                            | El campo `confirmPassword` se valida con `.extend().refine()` solo en el página. Antes del POST se destructura para no pasarlo al backend. Mantiene la API contract limpia.                                                                                                      |
| **Sidebar: longest-prefix-wins + optimistic highlight**                             | Bug previo: en `/investor/portfolio` se marcaban Inicio Y Portafolio (`startsWith('/investor')` true para ambos). Fix: `path === href \|\| path.startsWith(href + '/')` + comparar prefix-length. Optimistic local state hace que el highlight se mueva al instante del click.   |
| **`outputFileTracingRoot` pinned a monorepo root**                                  | Next inferá un `pnpm-lock.yaml` perdido en `C:\Users\USER\` como workspace root. Pin explícito evita warnings y trace de archivos incorrectos para production output.                                                                                                            |
| **Scripts de inspección DB en `scripts/check-*.ts`**                                | Útiles para debugging futuros (verificar wallet linkage, KYC state, audit log). Se corren via `pnpm exec dotenv -e ../../.env -- pnpm exec tsx ...` desde `apps/web/`.                                                                                                           |

## Convenciones del proyecto (CLAUDE.md hard rules)

- **Spanish first** en strings user-facing.
- **Custom errors** sobre require strings.
- **No PII en logs**.
- **Cada transfer path en SecurityToken debe llamar compliance.canTransfer + emitir Transfer** — el patrón `_update` lo garantiza.
- **Cada admin endpoint backend escribe audit_log ANTES de tocar chain**.
- **Cada order POST verifica firma EIP-712** — nunca trust `maker` from body.
- **Audit log inmutable** — append-only en Postgres + eventos on-chain.
- **No crear archivos `.md` nuevos sin pedido explícito del user** — este handoff es excepción autorizada.

---

# 10. CURRENT STATUS

## Dónde exactamente estamos detenidos

**Sesión cerrada cleanly tras 2 commits + push a `origin/main`.**

Working tree: `git status --short` muestra solo `?? .claude/settings.local.json` (user-local, intencional). Todo lo demás commiteado y pushed.

## Logros tangibles de la sesión 1

1. **7 smart contracts producción-ready** en `packages/blockchain/src/` (5 core + 1 interface + 3 módulos)
2. **141 tests Foundry** verde, 16ms ejecución
3. **5 contratos deployados live en Fuji 43113** (manifest en `deployments/43113.json`)
4. **1 demo SecurityToken (ARKDEMO) deployado vía factory** + supply primario minteado a Alice
5. **Demo flow end-to-end ejecutado on-chain** (9 TXs verificables en Snowtrace)
6. **Frontend hooks live reads**: `useKycStatus`, `useTokenHolding`, `OnChainStatusCard` montado en investor dashboard
7. **Backend `.env` sincronizado** con direcciones Fuji
8. **7 docs actualizados** + 1 nuevo (`deployment.md`)

## Logros tangibles de la sesión 2

1. **Sumsub KYC sandbox end-to-end integrado** (WebSDK widget + token endpoint + status polling + webhook HMAC-verified)
2. **Real SIWE-like wallet linking** que reemplaza al mock 100% fake. Verifica firma server-side con viem, anti-replay con timestamp window
3. **Helper viem directo a `IdentityRegistry`** que bypassea el SDK avalanche roto. Idempotente, falla silenciosa
4. **`GET /api/admin/investors`** que devuelve data real (User + Wallet + Identity + KycRecord + trades aggregation) con auto-reconcile batched+throttled de pending Sumsub records
5. **Landing polish**: CTA animado pre-FAQ (BackgroundPaths), Compliance section como bento grid, HowItWorks address con ASCII ellipsis
6. **Admin/jurisdictions con globo 3D Cobe** WebGL theme-aware (light = warm beige original, dark = brand-blue glow), lock icons en países bloqueados
7. **Bug fixes**: 5+ hydration mismatches resueltos, `useAuditLog` handles wrapped response, `withErrorHandler` ctx type fix, `linkWallet` case-insensitive match
8. **Build de producción verde** (`next build` exit 0, ~60 rutas generadas, middleware 34.4 kB)
9. **Optimizaciones**: reconcile batched 5x con `Promise.allSettled` + throttle 15s, `outputFileTracingRoot` pinned, `.next` cache limpio
10. **Sidebar fixes**: longest-prefix-wins active state + optimistic highlight + drop cross-portal links (RBAC)
11. **Topbar logout**: shader farewell screen + redirect a landing (mirrors login UX)
12. **Register**: confirmar contraseña field con cross-field Zod refine
13. **Scripts de inspección DB**: `scripts/check-wallet.ts`, `scripts/check-kyc.ts`
14. **HANDOFF actualizado** (este documento)

## Comportamiento en ejecución

- Si arrancas `pnpm dev`: frontend funciona, conectando wallet a Fuji el dashboard muestra "Estado on-chain · Fuji" con balance USDC y ARKDEMO + KYC status leídos en vivo.
- `forge test` desde `packages/blockchain` corre los 141 tests verde.
- `forge script script/Deploy.s.sol --rpc-url $env:AVALANCHE_RPC_URL` simula deploy sin gastar gas.
- `forge script script/DemoFlow.s.sol --rpc-url $env:AVALANCHE_RPC_URL --broadcast` ejecuta otro demo trade (offering ID único cada run usando block.timestamp).

## Estado de la deployer wallet

```
Address:       0x66Cb45eE3646759179901567Fa81Fe2EBa639278
Balance AVAX:  ~0.4895 (al cierre sesión 1; revisar antes de hacer más TXs)
Balance USDC:  10,000.25 (10k del mint inicial + 0.25 del fee del demo trade)
KYC status:    Verified (on-chain en IdentityRegistry)
Roles:         oracle (IR), admin (CM, Factory, Settlement), matcher (Settlement),
               fee recipient, issuer admin del ARKDEMO demo, AGENT_ROLE del ARKDEMO
```

## Usuarios reales en DB (sesión 2)

```
migue714.mg@gmail.com    role=admin     wallet=0xa24f1a1afb5ca441554633b750923e6e6eef7dd9   kyc=pending
josemg.714@hotmail.com   role=investor  wallet=0x5f5300...2abb                              kyc=pending
+ 5 seed users (example.mx)  role=investor  kyc=verified                                    provider=mock
```

Si `KycRecord.status='pending'` se queda atascado, revisar:

1. Tunnel de cloudflare arriba? (`curl -m 5 -o /dev/null -w "%{http_code}" https://<sub>.trycloudflare.com`)
2. URL del webhook en Sumsub dashboard apunta al tunnel actual?
3. Sumsub aprobó el applicant del lado de provider? (cockpit.sumsub.com → Applicants)
4. Si todo lo anterior está bien y sigue pending → recarga `/admin/investors` (dispara reconcile)

---

# 11. BLOCKERS / RISKS

## Riesgos actuales

| Riesgo                                                           | Severidad                                        | Mitigación                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Private key del deployer en `.env` local**                     | Media (testnet only, gitignored)                 | Mantener .env fuera de git. NUNCA usar esta key en mainnet.                                                                                                               |
| **Sumsub credentials compartidas en chat (sandbox)**             | Baja (sandbox, prefijo `sbx:`)                   | Después del hackathon, rotar desde el Sumsub dashboard. Las credenciales están en `.env` gitignored.                                                                      |
| **`CHAIN_MODE=avalanche` con adapter SDK no implementado**       | Media (rutas SDK-based dan 500 en runtime)       | Mi código nuevo (Sumsub, on-chain verify) usa viem directo y NO depende del SDK. Las rutas viejas (offerings/orders/match) sí dependen y dan 500 hasta que se implemente. |
| **Tunnel Cloudflare Quick Tunnels son efímeros**                 | Media (afecta sólo webhook)                      | Polling + reconcile pasivo cubren el caso webhook-down. Para URL persistente: deploy a Vercel (steps en sección 12).                                                      |
| **Frontend type-check tiene 3 errores Zod v3/v4 pre-existentes** | Baja (no bloquean, no introducidos por nosotros) | Pendiente fix global de Zod versioning, no urgente.                                                                                                                       |
| **Faucet oficial de Avalanche requiere cupón**                   | Media (afecta onboarding de nuevos devs)         | Documentado uso de Chainlink/Stakely como fallbacks en `deployment.md`.                                                                                                   |
| **`MAX_FEE_BPS = 500` es constant, no setteable**                | Baja (por diseño)                                | Si necesitamos cambiar el cap, requiere redeploy del Settlement. Esto es intencional para garantía.                                                                       |
| **Settlement requiere approvals previos de ambas partes**        | Baja                                             | UX standard de DEX. Frontend debe guiar al user a hacer `approve(Settlement, max)` antes de firmar órdenes.                                                               |
| **Mint público en MockUSDC**                                     | Crítica si se deploya en mainnet                 | Documentado en NatSpec. NUNCA deployar en mainnet.                                                                                                                        |
| **Indexer no está corriendo persistente**                        | Media                                            | Hoy se invoca manualmente. Para producción, daemon + monitoring.                                                                                                          |
| **Equipo de 2+ devs comparten una sola Supabase**                | Baja (intencional)                               | Comparten DB → ven la data del otro. No es un bug. Si quisieran isolation total, cada uno haría su Supabase free tier.                                                    |
| **Webhook Sumsub apunta a tunnel personal de un dev**            | Media (afecta otros devs si tunnel cae)          | Solo UNO de los devs debe correr tunnel a la vez. Los otros usan polling + reconcile. Solución permanente: Vercel deploy.                                                 |

## Potenciales blockers para próximas sesiones

1. **Si el adapter avalanche del SDK falla** → rutas `/api/offerings`, `/api/orders` etc dan 500. Frontend live reads + KYC + wallet linking + admin investors siguen funcionando porque usan viem directo.
2. **Si necesitamos verificar contratos en Snowtrace** → necesitamos `ROUTESCAN_API_KEY` (gratis en routescan.io, signup requerido).
3. **Si el saldo AVAX del deployer baja a < 0.01** → no podremos hacer más TXs sin refill. Hay 0.484 (al cierre s1; verificar antes de batch operations).
4. **Si OZ saca v5.7+ con breaking changes** → currently pin a 5.6.1 vía `forge install` (lock no estricto). Considerar `forge install OpenZeppelin/openzeppelin-contracts@v5.6.1` para pin explícito.
5. **Sumsub webhook URL stale** → admin no ve KYC updates de inmediato. **Fix**: el reconcile en `/api/admin/investors` cubre el caso. Si admin no recarga, polling del usuario en `/onboarding/kyc` también actualiza la DB.
6. **`.next` cache puede corromperse** mezclando pages/app router artifacts → `rm -rf apps/web/.next && pnpm exec next build` desde `apps/web/`.

---

# 12. NEXT PRIORITY TASKS

Ordenado por valor entregado al demo y al jurado.

## P0 — Demo polish (alto impacto, bajo esfuerzo)

1. **Verificar contratos en Snowtrace** (10–20 min)
   - Obtener `ROUTESCAN_API_KEY` en routescan.io
   - `forge verify-contract <address> src/<Contract>.sol:<Contract> --chain-id 43113 --etherscan-api-key $ROUTESCAN_API_KEY --watch`
   - Hacer para los 5 contratos core. Da credibilidad institucional al demo.

2. **Probar el frontend en browser** (10 min)
   - `pnpm dev`
   - Conectar Core Wallet con la deployer key importada
   - Confirmar que `OnChainStatusCard` muestra los datos correctos
   - Screenshot para el pitch deck

3. **Generar más actividad on-chain pre-demo** (15 min)
   - Correr `forge script script/DemoFlow.s.sol --broadcast` 2–3 veces (offering ID es único por timestamp)
   - Resultado: el explorer tiene historia visible y rica cuando el jurado entre a ver

## P1 — Funcionalidad faltante crítica

4. **Deploy a Vercel** (15–20 min) — URL persistente para webhook Sumsub
   - Conectar repo en vercel.com → New Project → root dir `apps/web`
   - Copiar todas las `SUMSUB_*`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `NEXTAUTH_*`, `NEXT_PUBLIC_*`, `*_PRIVATE_KEY`, `NEXT_PUBLIC_USE_MOCKS=false`, `CHAIN_MODE=mock` (importante: mock, no avalanche), addresses contratos
   - Tomar URL `https://hackathon-avalanche-*.vercel.app`
   - Actualizar webhook en Sumsub dashboard a `https://<vercel>/api/kyc/sumsub/webhook` — esta URL no cambia más

5. **Adapter avalanche real en `packages/sdk`** (4–8h)
   - Implementar las 5 interfaces (`IdentityRegistryAdapter`, `ComplianceRegistryAdapter`, `SecurityTokenAdapter`, `SettlementAdapter`, `OrderbookAdapter`) usando viem (mismo patrón que `lib/server/chain/identityRegistry.ts`)
   - Cambiar `CHAIN_MODE=avalanche` en `.env`
   - El matching engine del backend ahora settleará a Fuji real
   - Test: crear orden vía API → matching engine → ver TX real en chain

6. **`MaxInvestmentModule`** (1–2h)
   - Tope per-investor no calificado (cumple CNBV)
   - Storage: `mapping(address token => uint256 maxPerInvestor)` + `mapping(address token => mapping(address => uint256)) invested`
   - canTransfer: si receiver no es accredited, `invested[token][to] + amount <= max`
   - moduleAction: actualiza `invested[token][to] += amount` post-transfer
   - Tests Foundry + bind en demo flow

7. **`ClaimIssuer`** (2–3h)
   - Contrato que firma claims EIP-712 sobre identidades
   - `IdentityRegistry` opcional consulta claims firmadas en lugar de oracle directo
   - Permite identidad portable entre IFCs (Arkangeles claim válido en Bankaool)

## P2 — Frontend UX

7. **Página de oferta `/investor/offerings/[id]`** (2–4h)
   - Mostrar detalles del ARKDEMO en chain: name, symbol, totalSupply, holders
   - Botón "Comprar" → form que pide qty + price, firma EIP-712, POST a backend
   - Botón "Vender" mismo flow side=sell
   - Orderbook leído de Postgres (mock todavía) o de Settlement events

8. **Issuer portal: crear oferta nueva** (3–4h)
   - Form multi-step para definir name, symbol, supply, lockup, max holders, jurisdicciones
   - Llamar `TokenFactory.deployOffering(...)` desde wagmi
   - Actualizar `offerings` en Postgres

9. **Admin portal: bind/unbind módulos** (2h)
   - UI para llamar `ComplianceManager.bindModule(token, module)` y `unbindModule`
   - Tabla de módulos activos por oferta

## P3 — Pitch / demo material

10. **Pitch deck (10–12 slides)** — usar agente `pitch-builder` o skill `slides`
    - Hook, problema cuantificado, solución arquitectónica, demo screenshots, modelo de negocio, tracción (con los TX hashes verificables), roadmap
11. **Demo script 3 min** — guion para presentación en vivo
12. **Video demo grabado** — con audio limpio
13. **One-pager PDF** — logo + one-liner + bullets + QR al repo + QR al demo

## P4 — Producción / post-hackathon

14. **Auditoría formal de smart contracts** (Halborn o OpenZeppelin)
15. **Subnet propia en AvaCloud** — validadores Arkangeles + partners
16. **Sandbox CNBV** — aplicación al "modelo novedoso" de Ley Fintech
17. **KYC provider real** (Truora / Mati / Sumsub)
18. **Workers BullMQ corriendo persistentes**

---

# 13. RECOMMENDED IMPLEMENTATION ORDER

Paso a paso exacto para mañana, optimizado para entregar valor visible al jurado **lo antes posible**:

## Bloque 1: Polish del demo existente (1–1.5h)

1. **Abrir el repo y verificar estado:**
   ```bash
   git pull origin main
   git status
   git log --oneline -5
   ```
2. **Re-correr tests para confirmar nada se rompió:**
   ```bash
   cd packages/blockchain
   forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std  # si lib/ vacía
   forge test
   # Esperado: 141 tests passed
   cd ../..
   ```
3. **Verificar contratos en Snowtrace:**
   - Sign up en https://routescan.io (free)
   - Obtener API key
   - Agregar a .env: `ROUTESCAN_API_KEY="..."`
   - Para cada uno de los 5 core contracts:
     ```bash
     cd packages/blockchain
     forge verify-contract 0x8Ca947A8c9714548eCe376a879D6755048018A82 src/IdentityRegistry.sol:IdentityRegistry \
       --chain-id 43113 \
       --etherscan-api-key $env:ROUTESCAN_API_KEY \
       --verifier-url 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan' \
       --constructor-args $(cast abi-encode "constructor(address)" 0x66Cb45eE3646759179901567Fa81Fe2EBa639278) \
       --watch
     ```
   - Repetir para los otros 4 (cambiando args del constructor según corresponda)
4. **Arrancar el frontend y validar visualmente:**
   ```bash
   pnpm dev
   # En browser: http://localhost:3000
   # Conectar wallet con DEPLOYER key importada en MetaMask
   # Ir a /investor → verificar OnChainStatusCard muestra:
   #   - KYC verificado ✓
   #   - USDC: 10,000.25
   #   - ARKDEMO: 0 (deployer no tiene del demo)
   # Probar importando key de Alice → verificar 90 ARKDEMO + 49.75 USDC
   ```
5. **Generar más actividad on-chain:**
   ```bash
   cd packages/blockchain
   # Cada run crea un offering nuevo (id por timestamp)
   forge script script/DemoFlow.s.sol --rpc-url $env:AVALANCHE_RPC_URL --broadcast --slow
   # Hacer 2-3 runs para tener más historia visible en Snowtrace
   ```

## Bloque 2: Funcionalidad faltante (variable según prioridad)

**Opción A — si quieres impresionar técnicamente:** 6. Implementar `packages/sdk/src/blockchain/avalanche/` (los 5 adapters) 7. Cambiar `CHAIN_MODE=avalanche` en `.env` 8. Test end-to-end: API crea orden → matching engine → Settlement.executeMatch real

**Opción B — si quieres impresionar regulatoriamente:** 6. Implementar `MaxInvestmentModule` 7. Implementar `ClaimIssuer` con firma EIP-712 8. Bindear al demo offering 9. Test que prueba: investor no calificado no puede comprar > X

**Opción C — si quieres impresionar visualmente:** 6. Construir `/investor/offerings/[id]` con orderbook + EIP-712 signing UI 7. Construir `/issuer/offerings/new` que invoca `TokenFactory.deployOffering` 8. Screenshots/screencast del flujo

## Bloque 3: Material de pitch (al menos 2h antes del deadline)

9. Pitch deck 10–12 slides (usar skill `slides` o agente `pitch-builder`)
10. Demo script de 3 min
11. Video demo grabado
12. One-pager PDF

## Hard requirement antes del deadline

- Confirmar que el `README.md` muestra correctamente las addresses live
- Confirmar que `docs/deployment.md` está accesible (reproduce steps)
- Confirmar que la última versión está en `origin/main`
- URL del demo público (Vercel) — si no se ha deployado, hacerlo

---

# 14. READY-TO-PASTE CONTINUATION PROMPT

> Pega esto al inicio de un nuevo chat de Claude Code (con el directorio del proyecto abierto) para retomar exactamente desde donde quedamos.

---

```
Estoy retomando el proyecto Mercado Secundario IFC sobre Avalanche
(hackathon Avalanche LATAM 2026, cliente piloto Arkangeles).

CONTEXTO IMPORTANTE:
- Repo: github.com/Kaii35/hackathon-avalanche, branch main
- Working dir: c:\Users\USER\Desktop\hack\hackathon-avalanche
- Idioma: respóndeme en español; los strings user-facing del producto van en español, código/comentarios en inglés.
- CLAUDE.md y docs/SESSION-HANDOFF.md tienen TODO el contexto técnico.
  POR FAVOR LEE docs/SESSION-HANDOFF.md PRIMERO antes de proponer nada;
  es la memoria persistente entre sesiones.

ESTADO ACTUAL:
- 7 smart contracts ERC-3643 deployados en Avalanche Fuji (chain 43113):
  - IdentityRegistry  0x8Ca947A8c9714548eCe376a879D6755048018A82
  - ComplianceManager 0x8Db4A89761b208Da299dB9f1979252093A56C45A
  - TokenFactory      0x500B3F119E09fA4503f7fE8D5724Ca7776257956
  - Settlement        0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A
  - MockUSDC          0x31E5aA694baebF0420170bD9b132F9b5c4b38A83
  - Demo ARKDEMO      0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26 (deployado vía factory)
- 141 Foundry tests verde (8 suites, ~16ms)
- Demo flow end-to-end ejecutado on-chain (9 TXs reales en Snowtrace)
- Frontend live reads vía wagmi: useKycStatus, useTokenHolding, OnChainStatusCard

NUEVO EN SESIÓN 2:
- Sumsub KYC sandbox INTEGRADO end-to-end (token + status + webhook HMAC) — credenciales en .env
- Real SIWE-like wallet linking — POST /api/users/me/wallet con recoverMessageAddress + freshness check
- On-chain IdentityRegistry.verifyAddress via viem directo (bypassea SDK avalanche roto)
- GET /api/admin/investors con DATA REAL (User+Wallet+Identity+KycRecord+trades) + auto-reconcile
- Globo 3D Cobe theme-aware en admin/jurisdictions
- Landing: CTA animado pre-FAQ, Compliance bento grid, HowItWorks fix
- Confirmar contraseña en registro
- 5+ hydration mismatches resueltos
- Build de producción VERDE (next build exit 0)
- Último commit: 6173f08 (Sumsub + wallet linking + admin investors + landing polish)

CONFIGURACIÓN ACTUAL (.env, gitignored):
- CHAIN_MODE=avalanche (rutas SDK-based dan 500; mi código nuevo no depende del SDK)
- Sumsub sandbox configurado con level "basic-kyc-level"
- Webhook secret: cgMqJUVZRq6J375VRtd3j-_SiiP (de Sumsub dashboard)
- NEXT_PUBLIC_USE_MOCKS=false

USUARIOS EN DB:
- migue714.mg@gmail.com (admin, wallet 0xa24f...7DD9, KYC pending)
- josemg.714@hotmail.com (investor, wallet 0x5f53...2abb, KYC pending)
- 5 seeds *.example.mx (investor, KYC verified, provider=mock)

DECISIONES TÉCNICAS FIRMES (no cambiar sin razón):
- Solidity 0.8.24 + viaIR (NO 0.8.20 — OZ v5.6 lo requiere transitivamente)
- Foundry, no Hardhat
- OZ v5.6.1
- AccessControl con DEFAULT_ADMIN_ROLE + AGENT_ROLE en SecurityToken
- AccessControl con DEFAULT_ADMIN_ROLE + MATCHER_ROLE en Settlement
- Single _update gate en SecurityToken
- TokenFactory hace renounceRole al final (zero residual power)
- Settlement: EIP-712 ("ArkangelesSettlement" v1), MAX_FEE_BPS=500, nonReentrant
- Módulos compliance scoped por msg.sender
- Sumsub: KycRecord = source of truth, Identity = mirror on-chain (admin endpoint prioriza KycRecord.status)
- Reconcile en admin = batched 5x Promise.allSettled + throttle 15s in-process
- Helper viem directo en lib/server/chain/identityRegistry.ts bypassea el SDK roto
- Cobe globe re-init en theme change vía isDark en dep array

REGLAS HARD (de CLAUDE.md):
- Cada transfer path en SecurityToken DEBE pasar por compliance.canTransfer y emitir Transfer
- Cada admin endpoint backend escribe audit_log ANTES de tocar chain
- Cada order POST verifica EIP-712 sig (nunca trust maker from body)
- Sin PII en logs
- Spanish first en user-facing copy
- Solo emojis si el user lo pide
- No crear .md nuevos sin pedido explícito (este HANDOFF es excepción)

WEBHOOK SUMSUB:
- Cloudflare Quick Tunnel (efímero, URL cambia en cada restart)
- Solución persistente PENDIENTE: deploy a Vercel para URL fija
- Mientras tanto: polling + reconcile cubren cuando webhook no llega

PRÓXIMOS PASOS RECOMENDADOS (ver sección 12-13 para detalle):
1. Deploy a Vercel para webhook persistente (15-20 min)
2. Verificar contratos en Snowtrace (necesita ROUTESCAN_API_KEY)
3. Adapter avalanche real en packages/sdk (libera /api/offerings y matching engine)
4. MaxInvestmentModule + ClaimIssuer
5. Pitch deck + video + one-pager

COMANDOS PRINCIPALES:
- pnpm dev                                 # web :3000 + indexer :3001
- cd apps/web && pnpm exec next build      # build producción
- cd apps/web && pnpm exec tsc --noEmit    # type-check
- cd packages/blockchain && forge test     # 141 tests Foundry
- cloudflared tunnel --url http://localhost:3000  # tunnel efímero

Hoy quiero: <describe aquí qué quieres hacer en esta nueva sesión>
```

---

# 15. APÉNDICE: comandos rápidos de referencia

## Re-correr tests

```bash
cd packages/blockchain && forge test
```

## Compilar

```bash
cd packages/blockchain && forge build
```

## Generar bindings TypeScript (si quisiéramos)

No usado en esta sesión — el frontend usa ABIs minimales hand-written en `contracts.ts`. Si se quisiera tipado completo: `wagmi cli` con plugin de Foundry.

## Inspeccionar una TX

```bash
cast tx <TX_HASH> --rpc-url https://api.avax-test.network/ext/bc/C/rpc
cast receipt <TX_HASH> --rpc-url https://api.avax-test.network/ext/bc/C/rpc
```

## Decodificar custom errors

```bash
cast 4byte 0x12345678  # decode 4-byte selector to error name
```

## Mint USDC adicional al deployer (si baja)

```powershell
cast send 0x31E5aA694baebF0420170bD9b132F9b5c4b38A83 `
  "mint(address,uint256)" `
  0x66Cb45eE3646759179901567Fa81Fe2EBa639278 `
  1000000000 `
  --private-key $env:DEPLOYER_PRIVATE_KEY `
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
```

## KYC adicional de wallets (oracle = deployer)

```powershell
cast send 0x8Ca947A8c9714548eCe376a879D6755048018A82 `
  "verifyAddress(address)" 0xNEW_WALLET `
  --private-key $env:DEPLOYER_PRIVATE_KEY `
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
```

## Bindear un módulo al demo SecurityToken (ej. HoldingPeriod)

Primero deploy el módulo:

```powershell
forge create src/modules/HoldingPeriodModule.sol:HoldingPeriodModule `
  --constructor-args 0x66Cb45eE3646759179901567Fa81Fe2EBa639278 0x8Db4A89761b208Da299dB9f1979252093A56C45A `
  --private-key $env:DEPLOYER_PRIVATE_KEY `
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
```

Luego bindealo al ARKDEMO:

```powershell
cast send 0x8Db4A89761b208Da299dB9f1979252093A56C45A `
  "bindModule(address,address)" `
  0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26 `
  0xMODULE_ADDR `
  --private-key $env:DEPLOYER_PRIVATE_KEY `
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
```

---

**Fin del handoff. Total: 15 secciones + 4.B (KYC stack) y 16 (Sumsub setup), ~12k palabras de contexto técnico denso. Actualizado 2026-05-16 sesión 2 (commit `6173f08`). Diseñado para que mañana este documento solo + el comando de la sección 14 te permitan retomar sin perder ningún detalle.**

---

## 16. Sumsub setup — cheatsheet

Si retomas y necesitas re-configurar Sumsub desde cero o un sandbox nuevo:

1. **Cuenta Sumsub** → [cockpit.sumsub.com](https://cockpit.sumsub.com) → Dev space → App tokens
2. **Crear App Token** sandbox → te da `sbx:XXXX.YYYY` (app token) + secret key
3. Pega en `.env`:
   ```
   SUMSUB_BASE_URL=https://api.sumsub.com
   SUMSUB_APP_TOKEN="sbx:..."
   SUMSUB_SECRET_KEY="..."
   SUMSUB_LEVEL_NAME=basic-kyc-level
   SUMSUB_WEBHOOK_SECRET="<set después>"
   ```
4. **Crear Verification Level** en dashboard: Verification configurations → New level → name `basic-kyc-level` → agrega step `Identity document` (selecciona países MX/US/etc.)
5. **Webhook** (opcional pero recomendado para producción):
   - Levanta tunnel: `cloudflared tunnel --url http://localhost:3000`
   - Dashboard → Integrations → Webhooks → New
   - Objetivo: `https://<tunnel>.trycloudflare.com/api/kyc/sumsub/webhook`
   - Tipos: `applicantReviewed`, `applicantPending`, `applicantOnHold`, `applicantCreated`
   - Algoritmo: `SHA256`
   - Copia la clave secreta a `SUMSUB_WEBHOOK_SECRET` en `.env`
   - Reinicia `pnpm dev` (Next no recarga `.env` en HMR)
6. **Verificar end-to-end:**
   - Login con un user investor
   - Ir a `/onboarding/kyc` → "Iniciar verificación"
   - Completar flow (sandbox auto-aprueba)
   - Esperar polling capture o webhook callback (≤4s)
   - Si tienes wallet linkeada, verás link al TX en Snowtrace

**Scripts de inspección (útiles para debugging):**

```bash
# Verificar wallet en DB
cp scripts/check-wallet.ts apps/web/scripts-temp.ts && cd apps/web && pnpm exec dotenv -e ../../.env -- pnpm exec tsx scripts-temp.ts && rm scripts-temp.ts

# Verificar KycRecords y audit log
cp scripts/check-kyc.ts apps/web/scripts-temp.ts && cd apps/web && pnpm exec dotenv -e ../../.env -- pnpm exec tsx scripts-temp.ts && rm scripts-temp.ts
```
