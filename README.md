# Hackathon Avalanche — Mercado Secundario IFC

Plataforma de tokenización y mercado secundario de participaciones de Instituciones de Financiamiento Colectivo (IFC) sobre Avalanche, con compliance CNBV nativo a nivel de smart contract.

> **Cliente piloto:** Arkangeles
> **Stack:** Next.js · TypeScript · Node.js · Foundry · Avalanche L1
> **Status:** ✅ Live on Avalanche Fuji (chain 43113) · 141 tests verde · trade real settleado on-chain

## Live deployment (Avalanche Fuji)

| Contrato          | Address                                      | Explorer                                                                                     |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| IdentityRegistry  | `0x8Ca947A8c9714548eCe376a879D6755048018A82` | [Snowtrace](https://testnet.snowtrace.io/address/0x8Ca947A8c9714548eCe376a879D6755048018A82) |
| ComplianceManager | `0x8Db4A89761b208Da299dB9f1979252093A56C45A` | [Snowtrace](https://testnet.snowtrace.io/address/0x8Db4A89761b208Da299dB9f1979252093A56C45A) |
| TokenFactory      | `0x500B3F119E09fA4503f7fE8D5724Ca7776257956` | [Snowtrace](https://testnet.snowtrace.io/address/0x500B3F119E09fA4503f7fE8D5724Ca7776257956) |
| Settlement        | `0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A` | [Snowtrace](https://testnet.snowtrace.io/address/0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A) |
| MockUSDC          | `0x31E5aA694baebF0420170bD9b132F9b5c4b38A83` | [Snowtrace](https://testnet.snowtrace.io/address/0x31E5aA694baebF0420170bD9b132F9b5c4b38A83) |

**Demo on-chain ejecutado**: trade EIP-712 settleado atomicamente — [TX `0x7c9ff5...baf5d0`](https://testnet.snowtrace.io/tx/0x7c9ff5535304819d523e21d2852cb38cd6a73d691498109c4a12cace35baf5d0). Ver [docs/deployment.md](./docs/deployment.md) para el manifest completo y la reproducción.

---

## ¿Qué resuelve?

Hoy un inversionista que entra a una oferta de equity crowdfunding queda atrapado 5–10 años sin poder vender su participación. Esto deprime la demanda primaria y limita el crecimiento del mercado.

Construimos la primera infraestructura on-chain donde:

1. Las participaciones se emiten como **security tokens compliance-native** (estándar ERC-3643).
2. El cumplimiento (KYC, holding period, max holders, jurisdicción) está embebido en el contrato — no se puede evadir.
3. Existe un **mercado secundario** entre inversionistas calificados con settlement atómico contra stablecoin.
4. La cap table es la blockchain — no más Excel ni reconciliación manual.

## Arquitectura

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el detalle completo.

```
apps/
  web/        Next.js — Investor Portal, Issuer Portal, Compliance Admin
  indexer/    Worker Node.js — escucha eventos on-chain
packages/
  contracts/  Solidity — security tokens, compliance, orderbook, settlement
  shared/     Tipos TS compartidos
  sdk/        Cliente TS para hablar con los contratos
  ui/         Componentes React reutilizables
docs/         Documentación técnica y regulatoria
```

## Quick start (post-install)

```bash
pnpm install
docker compose up -d              # Postgres + Redis local (alternativa a Supabase/Upstash hosted)

# Smart contracts (Foundry)
cd packages/blockchain
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
forge test                        # 141 tests

# Frontend + indexer
cd ../..
pnpm dev                          # Levanta web + indexer
```

## Roadmap del hackathon

| Día | Entregable                                                         | Status  |
| --- | ------------------------------------------------------------------ | ------- |
| 1   | Contratos base (Identity, Compliance, SecurityToken) con tests     | ✅      |
| 2   | Factory + Settlement + módulos compliance + deploy en Fuji         | ✅      |
| 3   | Frontend: wallet, onboarding KYC mock, vista de oferta             | ✅      |
| 4   | Frontend: place order, ejecutar trade, cap table, admin compliance | 🟡 mock |
| 5   | Indexer + portfolio + pulido visual + video demo + pitch           | 🟡      |

## Licencia

Propietario — Hackathon Avalanche LATAM 2026.
