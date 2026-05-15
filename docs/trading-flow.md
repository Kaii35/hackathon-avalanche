# Flujo de Trading (Mercado Secundario)

## Modelo: matching off-chain + settlement on-chain

```
Inversionista A    Frontend         Backend (matching)    Settlement.sol
      │               │                    │                    │
      ├─ Sign sell ──►│                    │                    │
      │  EIP-712      ├─ POST /orders ────►│                    │
      │               │                    ├─ Save Postgres     │
      │               │                    ├─ Push Redis book   │
      │               │◄─── 201 ───────────┤                    │
      │               │                    │                    │
Inversionista B       │                    │                    │
      │               │                    │                    │
      ├─ Sign buy ───►│                    │                    │
      │               ├─ POST /orders ────►│                    │
      │               │                    ├─ Match con sell    │
      │               │                    ├─ executeMatch ────►│
      │               │                    │                    ├─ verify sigs
      │               │                    │                    ├─ token.transferFrom (compliance)
      │               │                    │                    ├─ usdc.transferFrom
      │               │                    │                    ├─ emit TradeExecuted
      │               │                    │◄────── tx hash ────┤
      │               │◄─ trade settled ───┤                    │
      │◄─ notif ──────┤                    │                    │
```

## Ventajas vs orderbook 100% on-chain

| Aspecto | Off-chain matching + on-chain settlement | 100% on-chain |
|---------|------------------------------------------|---------------|
| Costo | ~1 tx por trade ejecutado | 1 tx por orden + 1 por cancel + 1 por match |
| Velocidad UX | Instantáneo (sign + post) | Espera por bloque |
| Auditoría CNBV | Eventos on-chain + log off-chain firmado | Estado completo on-chain |
| MEV | Mitigado (matcher centralizado) | Frontrunning posible |

## EIP-712 Order schema

Ver `packages/sdk/src/eip712.ts`. El hash de la orden se calcula off-chain con la misma estructura que verifica `Settlement.sol`, garantizando que el matching engine no puede falsificar órdenes.

## Cancelación

- Cancelación off-chain (default): el backend marca la orden como cancelada y el matcher la ignora.
- Cancelación on-chain (opcional): para garantía absoluta, el usuario puede llamar `OrderBook.cancelOrder(hash)`. Útil si pierde confianza en el matcher.
