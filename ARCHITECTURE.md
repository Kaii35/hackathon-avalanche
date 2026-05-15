# Arquitectura — Mercado Secundario IFC sobre Avalanche

## 1. Visión

Plataforma white-label que cualquier IFC (empezando con Arkangeles) puede usar para emitir participaciones tokenizadas, mantener cap table on-chain y operar un mercado secundario regulado entre inversionistas calificados. La diferencia frente a un DEX genérico: el cumplimiento CNBV está embebido a nivel de smart contract.

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

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, shadcn/ui |
| Web3 | wagmi v2, viem, RainbowKit |
| Backend | Node.js 20, TypeScript, Next.js API Routes + worker para indexer |
| ORM / DB | Prisma + PostgreSQL |
| Cache / Queues | Redis + BullMQ |
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin, base ERC-3643 (T-REX) |
| Blockchain | Avalanche Fuji (hackathon) → Subnet AvaCloud (producción) |
| Storage | IPFS / Pinata para prospectos |
| Indexing | Event listener custom en Node (The Graph como upgrade) |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | Vercel (web), Railway (indexer + DB), AvaCloud (subnet) |

## 4. Smart contracts (corazón del sistema)

Basados en **ERC-3643 (T-REX)** — estándar de facto para security tokens regulados.

| Contrato | Responsabilidad |
|----------|-----------------|
| `IdentityRegistry.sol` | Mapea wallet → identidad legal verificada con claims |
| `ClaimIssuer.sol` | Emite claims firmadas (Arkangeles como issuer de KYC) |
| `ComplianceRegistry.sol` | Orquesta módulos de compliance por token |
| `modules/HoldingPeriodModule.sol` | Bloquea transferencias antes del lockup |
| `modules/MaxHoldersModule.sol` | Limita número máximo de holders (regla CNBV) |
| `modules/JurisdictionModule.sol` | Restringe transferencias por país |
| `modules/MaxInvestmentModule.sol` | Tope por inversionista no calificado |
| `SecurityToken.sol` | ERC-20 + hooks que consultan Compliance |
| `TokenFactory.sol` | Despliega un nuevo SecurityToken por oferta |
| `OrderBook.sol` | Registro de órdenes firmadas (matching off-chain) |
| `Settlement.sol` | Atomic swap token vs USDC con verificación de compliance |
| `Escrow.sol` | Custodia temporal durante settlement |
| `MockUSDC.sol` | Stablecoin de pruebas en testnet |

**Decisión clave:** matching off-chain (firmas EIP-712) + settlement on-chain. Razón: orderbook 100% on-chain es caro y lento; este patrón da UX de exchange tradicional con garantías de blockchain.

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

**Local (dev):** Hardhat node + Docker Compose (Postgres + Redis) + `pnpm dev` arranca todo via Turborepo.

**Hackathon (demo):** Contratos en Avalanche Fuji + Vercel para web + Railway para indexer/DB + Pinata para IPFS.

**Producción:** Subnet propia en AvaCloud, validadores Arkangeles + partners, gas en stablecoin, infra cloud propia (data residency MX).

## 9. Compliance / Regulatorio (CNBV / Ley Fintech)

- Tokens son **representación digital de participación**, no securities en sí (matiz para evitar Ley del Mercado de Valores).
- `MaxHoldersModule` enforza el límite de inversionistas por oferta de la Ley Fintech.
- `forced transfer` y `freeze` son requisito regulatorio, no opcionales.
- Audit log inmutable de todo: requisito de Disposiciones de Carácter General de CNBV.
