# Flujo de Trading (Mercado Secundario)

## Modelo: matching off-chain + settlement on-chain

```
Inversionista A    Frontend         Backend (matching)    Settlement.sol (Fuji)
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
      │               │                    │                    ├─ verify EIP-712 sigs (2x)
      │               │                    │                    ├─ check expiration + price cross
      │               │                    │                    ├─ update filled[hash] (anti-replay)
      │               │                    │                    ├─ safeTransferFrom seller→buyer (token)
      │               │                    │                    │     └─ SecurityToken._update
      │               │                    │                    │         ├─ Pausable + Freeze checks
      │               │                    │                    │         ├─ ComplianceManager.canTransfer
      │               │                    │                    │         │  (KYC + modules)
      │               │                    │                    │         └─ ComplianceManager.moduleAction
      │               │                    │                    ├─ safeTransferFrom buyer→seller (USDC)
      │               │                    │                    ├─ safeTransferFrom buyer→feeRecipient (fee)
      │               │                    │                    ├─ emit TradeExecuted
      │               │                    │◄────── tx hash ────┤
      │               │◄─ trade settled ───┤                    │
      │◄─ notif ──────┤                    │                    │
```

## Ventajas vs orderbook 100% on-chain

| Aspecto        | Off-chain matching + on-chain settlement         | 100% on-chain                               |
| -------------- | ------------------------------------------------ | ------------------------------------------- |
| Costo          | ~1 tx por trade ejecutado                        | 1 tx por orden + 1 por cancel + 1 por match |
| Velocidad UX   | Instantáneo (sign + post)                        | Espera por bloque                           |
| Auditoría CNBV | Eventos on-chain + log off-chain firmado         | Estado completo on-chain                    |
| MEV            | Mitigado (matcher centralizado con MATCHER_ROLE) | Frontrunning posible                        |

## EIP-712 Order schema

El struct firmado por cada parte:

```solidity
struct Order {
  address maker; // Quien firma la orden
  address token; // SecurityToken siendo intercambiado
  address paymentToken; // Token de pago (USDC en este flujo)
  Side side; // enum Side { Buy, Sell }
  uint256 qty; // En base units del token (18 decimales)
  uint256 price; // Base units del paymentToken POR 1 TOKEN ENTERO
  uint256 expiresAt; // Unix seconds — orden inválida después
  uint256 salt; // Uniqueness — previene colisión de hash en órdenes idénticas
}
```

**Pricing convention**: `price` se denomina en base units del paymentToken por **1 token entero** (es decir, por `10**tokenDecimals`). Para un SecurityToken con 18 decimales y USDC con 6 decimales, `price = 10_000_000` significa **10 USDC por share**. La fórmula del settlement:

```
paymentAmount = (fillQty * price) / 10**18
fee           = (paymentAmount * feeBps) / 10_000
sellerProceeds = paymentAmount - fee
```

El **execution price** es el ask del vendedor (maker pricing) — si `buy.price > sell.price`, el comprador captura el "spread improvement".

## Domain separator

```
EIP712("ArkangelesSettlement", "1") + chainId (43113 en Fuji) + verifyingContract = Settlement address
```

Cada deployment de `Settlement` tiene su propio domain separator (depende de `address(this)` y `block.chainid`). Esto previene replay cross-chain y cross-deployment automáticamente.

## Anti-replay y partial fills

`Settlement` mantiene:

```solidity
mapping(bytes32 orderHash => uint256 qtyFilled) public filled;
mapping(bytes32 orderHash => bool) public cancelled;
```

Cada `executeMatch` decrementa la capacidad restante de cada orden. La misma firma EIP-712 puede settlearse en N parcial fills hasta agotar `qty`. Tras `qty`, cualquier intento revierte con `InvalidFillQty()`. La cancelación on-chain (`cancelOrder`) es idempotente.

## Fee model

| Variable       | Valor inicial Fuji                    | Cap (constante)                       |
| -------------- | ------------------------------------- | ------------------------------------- |
| `feeBps`       | 50 (0.50%)                            | `MAX_FEE_BPS = 500` (5%)              |
| `feeRecipient` | Deployer (Arkangeles treasury futuro) | configurable por `DEFAULT_ADMIN_ROLE` |

Hard cap del 5% en código: ni un admin comprometido puede vampirizar al usuario.

## RBAC del Settlement

| Función                  | Rol                                                           |
| ------------------------ | ------------------------------------------------------------- |
| `executeMatch(...)`      | `MATCHER_ROLE` (solo el backend del platform)                 |
| `setFee(bps, recipient)` | `DEFAULT_ADMIN_ROLE`                                          |
| `cancelOrder(order)`     | Solo `order.maker` (cualquier wallet puede cancelar SU orden) |

## Cancelación

- **Cancelación off-chain (default)**: el backend marca la orden como `cancelled` en Postgres y el matcher la ignora.
- **Cancelación on-chain (opcional)**: para garantía absoluta, el maker llama `Settlement.cancelOrder(order)` y el contrato marca `cancelled[hash] = true`. Es idempotente (re-cancelar es no-op). Útil si el maker pierde confianza en el matcher.

## Deployment + demo on-chain

| Pieza                          | Address Fuji                                 |
| ------------------------------ | -------------------------------------------- |
| `Settlement`                   | `0x491BCC419E8Dd90d1783c234151c5B57A0Dc2A2A` |
| `MockUSDC`                     | `0x31E5aA694baebF0420170bD9b132F9b5c4b38A83` |
| Demo `SecurityToken` (ARKDEMO) | `0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26` |

**Trade real ejecutado**: 10 ARKDEMO @ 5 USDC entre dos wallets ephemeral KYC'd. Notional 50 USDC, fee 0.25 USDC (0.5%), seller cobra 49.75 USDC. Todo en una sola TX atómica con verificación de 2 firmas EIP-712 + 3 transferencias ERC-20:

- TX hash: [`0x7c9ff5535304819d523e21d2852cb38cd6a73d691498109c4a12cace35baf5d0`](https://testnet.snowtrace.io/tx/0x7c9ff5535304819d523e21d2852cb38cd6a73d691498109c4a12cace35baf5d0)
- Reproducible vía `forge script script/DemoFlow.s.sol --rpc-url $AVALANCHE_RPC_URL --broadcast`.

Ver [docs/deployment.md](./deployment.md) para el manifest completo + todos los TX hashes.
