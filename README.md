# Hackathon Avalanche — Mercado Secundario IFC

Plataforma de tokenización y mercado secundario de participaciones de Instituciones de Financiamiento Colectivo (IFC) sobre Avalanche, con compliance CNBV nativo a nivel de smart contract.

> **Cliente piloto:** Arkangeles
> **Stack:** Next.js · TypeScript · Node.js · Hardhat · Avalanche L1

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
docker compose up -d              # Postgres + Redis local
pnpm --filter contracts compile
pnpm --filter contracts test
pnpm dev                          # Levanta web + indexer
```

## Roadmap del hackathon

| Día | Entregable |
|-----|------------|
| 1 | Contratos base (Identity, Compliance, SecurityToken) con tests |
| 2 | Factory + Settlement + OrderBook + deploy en Fuji + SDK |
| 3 | Frontend: wallet, onboarding KYC mock, vista de oferta, listar órdenes |
| 4 | Frontend: place order, ejecutar trade, cap table en vivo, admin compliance |
| 5 | Indexer + portfolio + pulido visual + video demo + pitch |

## Licencia

Propietario — Hackathon Avalanche LATAM 2026.
