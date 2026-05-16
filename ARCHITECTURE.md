# Arquitectura — Arca · Mercado Secundario Regulado sobre Avalanche

## 1. Visión

**Arca** es la plataforma white-label que cualquier IFC (empezando con Arkangeles) puede usar para emitir participaciones tokenizadas, mantener cap table on-chain y operar un mercado secundario regulado entre inversionistas calificados. La diferencia frente a un DEX genérico: el cumplimiento CNBV está embebido a nivel de smart contract.

## 2. Vista de alto nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  Investor Portal  │  Issuer Portal  │  Compliance Admin Panel   │
└────────────┬───────────────┬────────────────────┬───────────────┘
             │               │                    │
             ▼               ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js / API Routes)                  │
│  KYC Orchestrator │ Order Matching │ Indexer │ Notifications     │
└────────────┬───────────────┬────────────────────┬───────────────┘
             │               │                    │
       ┌─────▼─────┐   ┌─────▼─────┐       ┌─────▼─────┐
       │ Postgres  │   │   Redis   │       │   IPFS    │
       │ (perfiles,│   │ (orderbook│       │ (prospec- │
       │  órdenes, │   │   cache)  │       │   tos)    │
       │   KYC)    │   └───────────┘       └───────────┘
       └───────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AVALANCHE L1 (Subnet permissioned)                  │
│  IdentityRegistry │ ComplianceRegistry │ SecurityToken (ERC-3643)│
│  TransferModules  │ OrderBook/Settlement │ Escrow │ MockUSDC     │
└─────────────────────────────────────────────────────────────────┘
```

**Por qué subnet propia y no C-Chain:** validadores controlados por la IFC, gas pagable en stablecoin, transacciones permissioned a nivel de protocolo, throughput ajustado al volumen de un mercado regulado.

## 3. Stack tecnológico

| Capa            | Tecnología                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Frontend        | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, shadcn/ui                                   |
| Web3            | wagmi v2, viem, RainbowKit                                                                              |
| Backend         | Node.js 20, TypeScript, Next.js API Routes + worker para indexer                                        |
| ORM / DB        | Prisma + PostgreSQL                                                                                     |
| Cache / Queues  | Redis + BullMQ                                                                                          |
| Smart Contracts | Solidity 0.8.24 (viaIR), **Foundry** (forge + cast), OpenZeppelin v5.6.1, arquitectura ERC-3643 (T-REX) |
| Blockchain      | **Avalanche Fuji (deployado, chain 43113)** → Subnet AvaCloud (producción)                              |
| Storage         | IPFS / Pinata para prospectos                                                                           |
| Indexing        | Event listener custom en Node (The Graph como upgrade)                                                  |
| Monorepo        | pnpm workspaces + Turborepo                                                                             |
| Deploy          | Vercel (web), Railway (indexer + DB), AvaCloud (subnet)                                                 |

## 4. Smart contracts (corazón del sistema)

Basados en **ERC-3643 (T-REX)** — estándar de facto para security tokens regulados. Implementación en `packages/blockchain/` (Foundry).

| Contrato                          | Responsabilidad                                                                                                                                                                                | Status               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `IdentityRegistry.sol`            | Mapea wallet → KYC verificado (oracle-managed). Soporta verify/revoke + batch verify idempotente                                                                                               | ✅ deployado en Fuji |
| `ComplianceManager.sol`           | Bilateral KYC + lista per-token de módulos enchufables. Llamado en cada `SecurityToken._update`                                                                                                | ✅ deployado en Fuji |
| `modules/IComplianceModule.sol`   | Interfaz común: `canTransfer(token,from,to,amount)` view + `moduleAction(...)` state-changing post-transfer                                                                                    | ✅                   |
| `modules/HoldingPeriodModule.sol` | Bloquea transferencias secundarias antes del lockup; mints siempre permitidos                                                                                                                  | ✅                   |
| `modules/MaxHoldersModule.sol`    | Cap de holders únicos por oferta (regla CNBV); state mantenido en `moduleAction`                                                                                                               | ✅                   |
| `modules/JurisdictionModule.sol`  | Allowlist por país (ISO 3166-1 numeric). RBAC split: oracle pone jurisdicción del usuario, admin abre/cierra países                                                                            | ✅                   |
| `SecurityToken.sol`               | ERC-20 + AccessControl (DEFAULT_ADMIN_ROLE issuer, AGENT_ROLE compliance officer) + Pausable + per-wallet freeze + forcedTransfer (recovery). Single gate `_update` para todos los movimientos | ✅                   |
| `TokenFactory.sol`                | Despliega SecurityToken por oferta con role handover atómico (factory mintea inicial → grants admin al issuer → renuncia su propio admin)                                                      | ✅ deployado en Fuji |
| `Settlement.sol`                  | Atomic swap token↔USDC con verificación EIP-712, fill counters anti-replay, partial fills, cancelación on-chain, fee cap del 5%, MATCHER_ROLE                                                  | ✅ deployado en Fuji |
| `MockUSDC.sol`                    | ERC-20 con 6 decimales y mint público para fondear demos en testnet (NUNCA mainnet)                                                                                                            | ✅ deployado en Fuji |

**Módulos pendientes**: `MaxInvestmentModule` (tope inversionista no calificado), `ClaimIssuer` (claims firmadas externas), `OrderBook.sol` y `Escrow.sol` (custodia diferida T+1) — la arquitectura actual usa firmas EIP-712 puras + settlement atómico inmediato.

**Decisión clave:** matching off-chain (firmas EIP-712 sobre `Order` struct) + settlement on-chain en una sola TX atómica. Razón: orderbook 100% on-chain es caro y lento; este patrón da UX de exchange tradicional con garantías de blockchain.

**Tests:** 141 tests Foundry across 8 suites, 100% pass. Comando: `cd packages/blockchain && forge test`.

**Pragma + tooling:** Solidity 0.8.24, `viaIR = true`, `optimizer_runs = 200`, OpenZeppelin v5.6.1. La pareja viaIR + 0.8.24 es requisito transitivo de OZ v5.6 (MessageHashUtils, Strings, Bytes pin a `^0.8.24`).

## 5. Flujos clave

### 5.1 Onboarding de inversionista

1. Usuario registra y completa KYC (mock con datos sintéticos).
2. Backend valida y genera claim firmado por ClaimIssuer.
3. Usuario conecta wallet; backend hace `IdentityRegistry.registerIdentity(wallet, claim)`.
4. Wallet queda elegible para holdear y operar tokens.

### 5.2 Emisión de oferta

1. Operador Arkangeles crea oferta en dashboard.
2. Sube prospecto a IPFS; hash queda on-chain.
3. Configura supply, lockup, max holders, jurisdicciones permitidas.
4. `TokenFactory.deployToken(...)` despliega un nuevo SecurityToken.
5. Mint inicial a wallets de inversionistas primarios.

### 5.3 Trade en mercado secundario

1. Inversionista A firma orden de venta EIP-712 (off-chain, gratis).
2. Backend la guarda en Postgres + Redis.
3. Inversionista B firma orden de compra que cruza.
4. Matching engine arma transacción de Settlement.
5. `Settlement.executeMatch()` ejecuta atomicamente:
   - Verifica firmas de ambos
   - SecurityToken consulta ComplianceRegistry: ¿B puede recibir?
   - Si OK: transfiere tokens A→B, USDC B→A, cobra fee
   - Emite evento; indexer actualiza cap table
6. Si compliance falla, la tx revierte; nadie pierde nada.

### 5.4 Operaciones de compliance

- Freeze wallet (orden judicial)
- Forced transfer (recovery por pérdida de claves)
- Update whitelist
- Pause token (suspensión de emergencia)

## 6. Modelo de datos off-chain (Postgres)

```
users           (id, email, role, created_at)
identities      (user_id, wallet, kyc_status, jurisdiction, accredited, claim_hash)
issuers         (id, name, cnbv_license, kyc_issuer_address)
offerings       (id, issuer_id, token_address, name, prospectus_ipfs, lockup_until)
cap_table       (offering_id, wallet, balance, last_updated_block)
orders          (id, type, offering_id, wallet, qty, price, signature, status, expires_at)
trades          (id, buy_order_id, sell_order_id, qty, price, tx_hash, settled_at)
kyc_records     (user_id, provider, payload, verified_at)
audit_log       (action, actor, target, payload, timestamp)
```

## 7. APIs principales (Next.js Route Handlers)

```
POST   /api/kyc/start              Inicia KYC
POST   /api/kyc/webhook            Callback del provider
POST   /api/identity/link-wallet   Asocia wallet a usuario verificado
GET    /api/offerings              Lista de ofertas activas
GET    /api/offerings/:id          Detalle + cap table
POST   /api/orders                 Crea orden firmada
GET    /api/orders/book/:offering  Orderbook agregado
DELET/api/orders/:id               Cancela orden
POST   /api/match/execute          Trigger manual de matching (demo)
GET    /api/portfolio/:wallet      Holdings del usuario
POST   /api/admin/freeze           Compliance ops
POST   /api/admin/whitelist        Add/remove de IdentityRegistry
```

## 8. Infraestructura

**Local (dev):** Foundry (`anvil` opcional para chain local) + Docker Compose (Postgres + Redis) o Supabase/Upstash hosted + `pnpm dev` arranca web + indexer via Turborepo.

**Hackathon (demo):** ✅ Contratos deployados en Avalanche Fuji (chain 43113, ver [docs/deployment.md](./docs/deployment.md)) + Supabase (Postgres) + Upstash (Redis) + Pinata para IPFS (planeado).

**Producción:** Subnet propia en AvaCloud, validadores Arkangeles + partners, gas en stablecoin, infra cloud propia (data residency MX).

## 9. Compliance / Regulatorio (CNBV / Ley Fintech)

- Tokens son **representación digital de participación**, no securities en sí (matiz para evitar Ley del Mercado de Valores).
- `MaxHoldersModule` enforza el límite de inversionistas por oferta de la Ley Fintech.
- `forced transfer` y `freeze` son requisito regulatorio, no opcionales.
- Audit log inmutable de todo: requisito de Disposiciones de Carácter General de CNBV.
