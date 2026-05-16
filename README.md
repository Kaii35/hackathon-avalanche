# Arca — Mercado Secundario Regulado

**Arca** es la plataforma de tokenización y mercado secundario de participaciones de Instituciones de Financiamiento Colectivo (IFC) sobre Avalanche, con compliance CNBV nativo a nivel de smart contract.

> _El nombre evoca el arca como custodia segura de valor — y guiña al cliente piloto Ark·angeles._

> **Cliente piloto:** Arkangeles
> **Hackathon:** Avalanche LATAM 2026
> **Stack:** Next.js 15 · TypeScript · Foundry · Avalanche Fuji L1 · Postgres · Redis · viem/wagmi
> **Status:** ✅ Live end-to-end en Avalanche Fuji (chain 43113) — trade real settleado on-chain entre 2 cuentas a través de la app

## TL;DR para jurado

1. **No es un DEX genérico** — un DEX no puede operar como secundario regulado en México porque no enforza KYC / jurisdicción / holding period a nivel protocolo. Aquí sí. ERC-3643 + módulos compliance enchufables.
2. **Loop completo cerrado on-chain** — KYC real (Sumsub sandbox) → wallet linking real (SIWE) → IdentityRegistry on-chain → firma EIP-712 off-chain → matching engine → settlement atómico en Fuji con verificación de 2 firmas + compliance check + transferencia + fee → indexer escucha el evento → cap table se actualiza en DB.
3. **Actos corporativos también on-chain** — Dividend distribution (push-allocation + pull-claim) y Governance (propose + weighted vote + finalize) deployados, smoke-tested y con UI completa.
4. **Demo verificable** — trade real entre 2 wallets a través de la UI: [TX `0x0dfa5f15…946b`](https://testnet.snowscan.xyz/tx/0x0dfa5f15a6d49930955db00fa1505681993b90adb04eee2eef08e4177adc946b) (bloque 55442697). Verifica firmas EIP-712 de ambas partes, ejecuta swap atómico ARKDEMO↔USDC, paga fee 0.5%, emite `TradeExecuted` consumido por el indexer.

---

## Contratos live (Avalanche Fuji 43113)

| Contrato                | Address                                      | Tests              | Explorer                                                                                                       |
| ----------------------- | -------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `IdentityRegistry`      | `0x8Ca947A8c9714548eCe376a879D6755048018A82` | 17 ✓ (verified)    | [Snowtrace](https://testnet.snowtrace.io/address/0x8Ca947A8c9714548eCe376a879D6755048018A82)                   |
| `ComplianceManager`     | `0x8Db4A89761b208Da299dB9f1979252093A56C45A` | 18 ✓ (verified)    | [Snowtrace](https://testnet.snowtrace.io/address/0x8Db4A89761b208Da299dB9f1979252093A56C45A)                   |
| `TokenFactory`          | `0x500B3F119E09fA4503f7fE8D5724Ca7776257956` | 20 ✓ (verified)    | [Snowtrace](https://testnet.snowtrace.io/address/0x500B3F119E09fA4503f7fE8D5724Ca7776257956)                   |
| `Settlement`            | `0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A` | 22 ✓ (verified)    | [Snowtrace](https://testnet.snowtrace.io/address/0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A)                   |
| `SecurityToken` ARKDEMO | `0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26` | 29 ✓ (via factory) | [Snowtrace](https://testnet.snowtrace.io/address/0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26)                   |
| `DividendDistributor`   | `0x71dA4E2cbc181F7eE9936c7A8243566fDcAb93c6` | 17 ✓ (verified)    | [Snowtrace](https://testnet.snowtrace.io/address/0x71dA4E2cbc181F7eE9936c7A8243566fDcAb93c6)                   |
| `Governance`            | `0xfd2619c9d7b36c32309e613065bc0fd4f71e5f6d` | 25 ✓ (verified)    | [Snowtrace](https://testnet.snowtrace.io/address/0xfd2619c9d7b36c32309e613065bc0fd4f71e5f6d)                   |
| `MockUSDC`              | `0x31E5aA694baebF0420170bD9b132F9b5c4b38A83` | —                  | [Snowtrace](https://testnet.snowtrace.io/address/0x31E5aA694baebF0420170bD9b132F9b5c4b38A83) (⚠️ testnet only) |

**Compliance modules** (deployable on demand, scoped por token): `HoldingPeriodModule`, `MaxHoldersModule`, `JurisdictionModule`.

**Total tests:** 183 Foundry tests verde, 0 fails, ejecución <20ms. Ver [docs/deployment.md](./docs/deployment.md) para el manifest completo y reproducción.

---

## Demo flow end-to-end (verificable on-chain)

```
┌─ Investor A (maria.lopez)                ┌─ Investor B (juan.perez)
│  1. KYC vía Sumsub sandbox               │  1. KYC vía Sumsub sandbox
│  2. SIWE wallet link (firma viem)        │  2. SIWE wallet link
│  3. backend → IdentityRegistry.verify    │  3. backend → IdentityRegistry.verify
│  4. Firma EIP-712 sell 3 ARKDEMO @ 4.50  │  4. Firma EIP-712 buy 3 ARKDEMO @ 4.80
└──────────────┬───────────────────────────┴──────────────┬───────────────────────
               ▼                                          ▼
       Backend matching engine (Postgres + Redis)
               │
               ▼
       Settlement.executeMatch(buy, buySig, sell, sellSig, fillQty)
               │
               ├─ Recover signers vs makers (revert si invalid)
               ├─ Check token mismatch, expiration, price cross
               ├─ filled[hash] += fillQty (anti-replay, CEI)
               ├─ ARKDEMO.safeTransferFrom(seller → buyer)
               │     └─ ComplianceManager.canTransfer (KYC bilateral + módulos)
               ├─ USDC.safeTransferFrom(buyer → seller, minus fee)
               ├─ USDC.safeTransferFrom(buyer → feeRecipient, 0.5%)
               └─ emit TradeExecuted
               │
               ▼
       Indexer (viem.watchContractEvent on Fuji)
               │
               ├─ cap_table_entries update (alice 85→82, bob 15→18)
               ├─ trades record (txHash, blockNumber, qty, price)
               └─ audit_log append
```

**TX real del demo (settlement atómico):** [`0x0dfa5f15…946b`](https://testnet.snowscan.xyz/tx/0x0dfa5f15a6d49930955db00fa1505681993b90adb04eee2eef08e4177adc946b) — bloque 55442697. ARKDEMO Transfer + USDC Transfer (buyer→seller, 13.43 USDC) + USDC Transfer (fee, 0.075 USDC) + TradeExecuted event, todo atómico en una sola TX.

---

## ¿Qué resuelve?

Hoy un inversionista que entra a una oferta de equity crowdfunding queda atrapado 5–10 años sin poder vender su participación. Esto deprime la demanda primaria y limita el crecimiento del mercado.

Construimos la primera infraestructura on-chain donde:

1. Las participaciones se emiten como **security tokens compliance-native** (ERC-3643 inspired).
2. El cumplimiento (KYC, holding period, max holders, jurisdicción) está embebido en el contrato — no se puede evadir.
3. Existe un **mercado secundario** entre inversionistas calificados con settlement atómico contra stablecoin.
4. La cap table **es la blockchain** — no más Excel ni reconciliación manual.
5. **Actos corporativos** (dividendos, governance vote) están on-chain y son auditables.

---

## Arquitectura

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el diseño completo.

```
apps/
  web/                   Next.js 15 — 3 portales (investor, issuer, admin)
                         + API Routes (Sumsub, EIP-712 verify, matching)
  indexer/               Worker Node.js — escucha Fuji directo vía viem
packages/
  blockchain/            Foundry — 8 contratos Solidity 0.8.24 + 183 tests
  shared/                Tipos TS + DTOs Zod compartidos
  sdk/                   Adapter viem para hablar con los contratos
  ui/                    React/shadcn components compartidos
  database/              Prisma schema (11 modelos) + migraciones + seed
docs/                    Arquitectura, compliance, trading flows
```

### On-chain ↔ off-chain split

| Capa                       | Lee de                                | Escribe a                                    |
| -------------------------- | ------------------------------------- | -------------------------------------------- |
| **Frontend** (wagmi/viem)  | Fuji directo (KYC, balances, hold)    | Wallet firma; backend orquesta settlement TX |
| **Backend** (Next.js API)  | Postgres + Sumsub + viem reads        | Postgres + chain (via SDK avalanche adapter) |
| **Indexer**                | Avalanche Fuji vía watchContractEvent | Postgres (cap_table_entries, trades, audit)  |
| **Smart contracts** (Fuji) | Identity + Compliance + state         | Eventos consumidos por el indexer            |

---

## Stack tecnológico

| Capa            | Tecnología                                                                           |
| --------------- | ------------------------------------------------------------------------------------ |
| Frontend        | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, shadcn/ui, Framer Motion |
| Web3            | wagmi v2, viem v2, RainbowKit, EIP-712 typed data                                    |
| Backend         | Node.js 20, Next.js Route Handlers, Prisma 5, PostgreSQL 16 (Supabase)               |
| Cache / Queues  | Redis 7 (Upstash) — Streams + Sorted Sets + sliding window rate limit                |
| Smart contracts | Solidity 0.8.24 (viaIR), Foundry, OpenZeppelin v5.6.1, ERC-3643 inspired             |
| Blockchain      | Avalanche Fuji (live) → AvaCloud subnet (producción)                                 |
| KYC             | Sumsub sandbox (HMAC webhook, WebSDK widget) + reconcile pasivo                      |

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Smart contracts
cd packages/blockchain
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
forge test                                       # 183 tests, ~20ms

# 3. Infra local (alternativa: Supabase + Upstash hosted)
cd ../..
docker compose up -d                             # Postgres + Redis

# 4. .env
cp .env.example .env
# Llena DATABASE_URL, REDIS_URL, JWT_SECRET, SUMSUB_*, DEPLOYER_PRIVATE_KEY

# 5. Prisma migrate + seed
pnpm --filter @hack/database prisma migrate dev
pnpm --filter @hack/database prisma db seed

# 6. Run
pnpm dev                                         # web :3000 + indexer :3001
```

### Indexer modes

```bash
# .env
INDEXER_MODE=fuji      # live on-chain (recomendado)
INDEXER_MODE=mock      # legacy (Redis Streams del mock chain)
INDEXER_MODE=both      # transición — corre ambos en paralelo
```

### Deploy a Fuji desde cero

```bash
cd packages/blockchain
forge script script/Deploy.s.sol \
  --rpc-url $AVALANCHE_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --slow
# Genera deployments/43113.json + deployments/latest.env
```

---

## Hard rules del proyecto

- **Solidity 0.8.24 + viaIR** — requisito transitivo de OZ v5.6 (MessageHashUtils, Strings, Bytes pin a `^0.8.24`).
- **Cada transfer path en SecurityToken** pasa por `compliance.canTransfer()` y emite `Transfer` — `_update` es la única puerta.
- **Cada admin endpoint** escribe a `audit_log` **antes** de tocar chain.
- **Cada order POST** verifica la firma EIP-712 server-side. `maker` nunca se trustea del body.
- **No PII** (RFC, CURP, nombres, emails) en logs — Pino tiene `redact` configurado.
- **Spanish-first** en strings user-facing. Código y comentarios en inglés.

---

## Roadmap

| Sprint | Entregable                                                             | Status |
| ------ | ---------------------------------------------------------------------- | ------ |
| 1      | Contratos base ERC-3643 + 141 tests Foundry                            | ✅     |
| 2      | TokenFactory + Settlement + 3 módulos compliance + deploy Fuji         | ✅     |
| 3      | Frontend: investor portal + KYC mock + onboarding wallet               | ✅     |
| 4      | KYC Sumsub real + SIWE wallet linking real + admin investors data real | ✅     |
| 5      | UI EIP-712 signing + matching engine + settlement on-chain end-to-end  | ✅     |
| 6      | DividendDistributor + Governance — deployed + tested + UI              | ✅     |
| 7      | Indexer escuchando Fuji real (watchContractEvent) + métricas live      | ✅     |
| 8      | Pitch deck + video demo + AvaCloud subnet propia                       | 🟡     |

**Post-hackathon:** auditoría formal (Halborn / OZ), sandbox CNBV, subnet propia, deploy producción.

---

## Documentos

- [docs/deployment.md](./docs/deployment.md) — manifest de deploy + reproduce steps
- [docs/compliance-flow.md](./docs/compliance-flow.md) — arquitectura modular de compliance
- [docs/trading-flow.md](./docs/trading-flow.md) — EIP-712 schema + settlement atómico
- [docs/regulatory-notes.md](./docs/regulatory-notes.md) — CNBV / Ley Fintech
- [docs/SESSION-HANDOFF.md](./docs/SESSION-HANDOFF.md) — memoria persistente entre sesiones
- [ARCHITECTURE.md](./ARCHITECTURE.md) — diseño técnico completo

---

## Licencia

Propietario — Hackathon Avalanche LATAM 2026.
