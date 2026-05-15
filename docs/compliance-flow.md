# Flujo de Compliance

## Onboarding KYC

```
Usuario          Frontend           Backend           ClaimIssuer       IdentityRegistry
  │                 │                  │                   │                   │
  ├─ Registro ─────►│                  │                   │                   │
  │                 ├─ POST /kyc/start►│                   │                   │
  │                 │                  ├─ Verifica datos   │                   │
  │                 │                  ├──────────────────►│                   │
  │                 │                  │  Firma claim      │                   │
  │                 │                  │◄──────────────────┤                   │
  │                 │                  ├─ registerIdentity(wallet, claim) ────►│
  │                 │                  │                   │  IdentityRegistered│
  │                 │◄─ verified ──────┤                   │                   │
  │◄─ "puedes operar"┤                  │                   │                   │
```

## Verificación pre-transfer

Cada `transfer()` del SecurityToken ejecuta:

1. `frozen[from]` y `frozen[to]` deben ser `false`.
2. `IdentityRegistry.isVerified(to)` debe ser `true`.
3. `ComplianceRegistry.canTransfer(token, from, to, amount)` itera todos los módulos:
   - `HoldingPeriodModule`: `block.timestamp >= lockupUntil[token]`
   - `MaxHoldersModule`: si `to` no es holder, `currentHolders < maxHolders`
   - `JurisdictionModule`: `allowedJurisdiction[token][to.jurisdiction] == true`
   - `MaxInvestmentModule`: si `to.accredited == false`, `amount <= max`
4. Si cualquier módulo retorna `false`, la transacción revierte.

## Operaciones de emergencia

| Acción | Quién | Contrato | Razón |
|--------|-------|----------|-------|
| `freezeWallet` | Compliance Officer / Settlement | SecurityToken | Orden judicial, sospecha AML |
| `forcedTransfer` | Compliance Officer | SecurityToken | Recovery por pérdida de claves |
| `setPaused(true)` | Issuer | SecurityToken | Suspensión emergencia regulatoria |
| `removeIdentity` | KYC Agent | IdentityRegistry | Revocación de KYC |
