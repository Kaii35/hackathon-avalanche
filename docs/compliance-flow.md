# Flujo de Compliance

## Arquitectura modular (ERC-3643)

El cumplimiento vive en tres capas que se atraviesan en cada movimiento del token, en este orden estricto:

```
SecurityToken._update (single gate, OZ v5 hook)
    ├─ 1. Pausable          → modifier whenNotPaused (emergency stop)
    ├─ 2. Freeze por wallet → mapping(address => bool) frozen
    ├─ 3. ComplianceManager.canTransfer(from, to, amount)
    │     ├─ a) Bilateral KYC vs IdentityRegistry
    │     │      (skip address(0) en mint/burn)
    │     └─ b) Itera _modules[token]:
    │            ├─ HoldingPeriodModule.canTransfer(...)
    │            ├─ MaxHoldersModule.canTransfer(...)
    │            ├─ JurisdictionModule.canTransfer(...)
    │            └─ ... (extensible)
    ├─ 4. super._update      → balance change + Transfer event
    └─ 5. ComplianceManager.moduleAction(from, to, amount)
          └─ Itera _modules[token] para state updates post-transfer
                (ej. MaxHoldersModule incrementa/decrementa holder count)
```

Las 5 capas son **mandatorias** en cada `transfer`, `mint`, `burn` y `forcedTransfer`. La única excepción documentada: `forcedTransfer` salta el freeze sobre `from` (porque el escenario de recovery es exactamente "mover tokens fuera de una wallet congelada"), pero mantiene compliance, freeze del receiver y pause.

## Onboarding KYC

```
Usuario          Frontend           Backend           IdentityRegistry (on-chain)
  │                 │                  │                   │
  ├─ Registro ─────►│                  │                   │
  │                 ├─ POST /kyc/start►│                   │
  │                 │                  ├─ Verifica datos   │
  │                 │                  │  (mock provider)  │
  │                 │                  ├─ verifyAddress(wallet) ────────►│
  │                 │                  │                   │  AddressVerified
  │                 │◄─ verified ──────┤                   │
  │◄─ "puedes operar"┤                  │                   │
```

`IdentityRegistry` es Ownable; solo el oracle (backend KYC) puede emitir `verifyAddress` o `revokeAddress`. Existe `batchVerifyAddresses` idempotente para onboarding masivo.

## Módulos de compliance

Cada módulo implementa `IComplianceModule`:

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

`canTransfer` es view (corre antes del transfer). `moduleAction` es state-changing y SOLO la puede llamar el `ComplianceManager` (modifier `onlyCompliance`). Los módulos viven en `packages/blockchain/src/modules/`.

### HoldingPeriodModule

| Atributo     | Valor                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| Estado       | `mapping(address token => uint256 lockupUntil)`                                  |
| canTransfer  | `from == 0` (mint) → siempre true. Else: `block.timestamp >= lockupUntil[token]` |
| moduleAction | No-op (módulo stateless)                                                         |
| Admin        | Ownable. `setLockup(token, timestamp)` configura por oferta                      |

**Razón de diseño**: el issuer debe poder distribuir supply inicial durante el lockup; solo bloqueamos transferencias secundarias.

### MaxHoldersModule

| Atributo     | Valor                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Estado       | `maxHolders[token]`, `holderCount[token]`, `isHolder[token][wallet]`                                                      |
| canTransfer  | Si `to` no es holder actual y `amount > 0`, requiere `holderCount + 1 <= cap`. Cap=0 = unlimited                          |
| moduleAction | Actualiza set de holders: decrementa si `from.balance == 0` post-transfer, incrementa si `to.balance > 0` y no era holder |
| Admin        | Ownable. `setMaxHolders(token, cap)`                                                                                      |

**Razón de diseño**: la regla CNBV de "máximo de inversionistas por oferta" se enforza on-chain. Los mappings desnormalizados (`isHolder` + `holderCount`) dan O(1) en lugar de iterar todos los holders.

### JurisdictionModule

| Atributo     | Valor                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Estado       | `jurisdictionOf[user]` (ISO 3166-1 numeric), `isJurisdictionAllowed[token][code]`                              |
| canTransfer  | Si `to != 0`, requiere `isJurisdictionAllowed[token][jurisdictionOf[to]] == true`. Burn permitido              |
| moduleAction | No-op (stateless)                                                                                              |
| Admin        | AccessControl: `ORACLE_ROLE` setea jurisdicción del usuario; `DEFAULT_ADMIN_ROLE` abre/cierra países por token |

**Razón de diseño**: separar oracle (quien declara jurisdicción del usuario, en sync con KYC) de admin (quien decide qué países pueden holdear cada oferta) cumple separation of duties regulatoria.

## Verificación pre-transfer (end-to-end)

Cada `SecurityToken.transfer()` ejecuta, en este orden:

1. `whenNotPaused` (Pausable) — modifier global del token.
2. `!frozen[from]` (saltado en `forcedTransfer`) y `!frozen[to]` siempre.
3. `complianceManager.canTransfer(from, to, amount)`:
   - `IdentityRegistry.isVerified(from)` y `.isVerified(to)` (skip si address(0))
   - `HoldingPeriodModule.canTransfer(...)` por cada módulo bindeado
   - `MaxHoldersModule.canTransfer(...)`
   - `JurisdictionModule.canTransfer(...)`
4. `super._update` aplica el cambio de balances + emite `Transfer`.
5. `complianceManager.moduleAction(from, to, amount)` notifica a módulos statefuls para actualizar agregados.

Si cualquier paso falla, la transacción revierte con un custom error tipado (`WalletFrozen(addr)`, `ComplianceCheckFailed(from, to)`, `EnforcedPause()`, etc.). Cero half-state.

## Operaciones de emergencia

| Acción                             | Quién (role)       | Contrato            | Razón                                                                                     |
| ---------------------------------- | ------------------ | ------------------- | ----------------------------------------------------------------------------------------- |
| `freezeWallet(addr)`               | AGENT_ROLE         | `SecurityToken`     | Orden judicial, sospecha AML                                                              |
| `unfreezeWallet(addr)`             | AGENT_ROLE         | `SecurityToken`     | Resolución del freeze                                                                     |
| `forcedTransfer(from, to, amount)` | AGENT_ROLE         | `SecurityToken`     | Recovery por pérdida de claves; bypassa freeze de `from` pero mantiene compliance + pause |
| `pause()` / `unpause()`            | DEFAULT_ADMIN_ROLE | `SecurityToken`     | Suspensión emergencia regulatoria (detiene TODO movimiento, incluso forced transfer)      |
| `revokeAddress(wallet)`            | Owner (oracle)     | `IdentityRegistry`  | Revocación de KYC (AML, KYC expirado, court order)                                        |
| `bindModule(token, module)`        | Owner              | `ComplianceManager` | Activar nueva regla compliance para una oferta                                            |
| `unbindModule(token, module)`      | Owner              | `ComplianceManager` | Retirar una regla                                                                         |

## Estado de implementación

| Componente                               | Status                                         | Tests |
| ---------------------------------------- | ---------------------------------------------- | ----- |
| `IdentityRegistry`                       | ✅ deployado en Fuji                           | 17 ✓  |
| `ComplianceManager` (modular)            | ✅ deployado en Fuji                           | 18 ✓  |
| `HoldingPeriodModule`                    | ✅ código + tests                              | 8 ✓   |
| `MaxHoldersModule`                       | ✅ código + tests                              | 13 ✓  |
| `JurisdictionModule`                     | ✅ código + tests                              | 10 ✓  |
| `MaxInvestmentModule`                    | 🟡 pendiente (tope per-investor no calificado) | —     |
| `ClaimIssuer` (claims firmadas externas) | 🟡 pendiente                                   | —     |
