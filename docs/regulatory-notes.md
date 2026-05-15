# Notas regulatorias — México (CNBV / Ley Fintech)

## Marco legal

- **Ley para Regular las Instituciones de Tecnología Financiera** (Ley Fintech, 2018)
- **Disposiciones de carácter general aplicables a las IFC** (CNBV)
- **Ley del Mercado de Valores** (LMV) — relevante porque las participaciones de IFC NO se consideran valores bajo LMV, pero la línea es delgada

## Decisiones de diseño que mitigan riesgo regulatorio

| Decisión | Justificación |
|----------|---------------|
| Tokens son "representación digital de participación", no securities | Evita caer bajo LMV; mantiene jurisdicción CNBV-Fintech |
| Mercado secundario opera **solo entre inversionistas previamente acreditados por la IFC** | Cumple con el límite de inversionistas por proyecto |
| `MaxHoldersModule` enforza límites por oferta | Cumplimiento técnico de límite por proyecto |
| `forced transfer` y `freeze` disponibles | Requisito regulatorio (KYC/AML, órdenes judiciales) |
| Audit log inmutable on-chain + Postgres | Cumple Disposiciones de Carácter General |
| Stablecoin fiat-backed (no algo) | Reduce riesgo de exposición cambiaria del inversionista |

## Inversionista calificado vs no calificado

- **No calificado**: persona física con tope de inversión por oferta y total anual.
- **Calificado**: cumple requisitos CNBV (ingresos, patrimonio o experiencia).
- El `MaxInvestmentModule` enforza topes técnicamente; el `IdentityRegistry` guarda el flag `accredited`.

## Roadmap regulatorio (post-MVP)

1. **Sandbox CNBV**: aplicar al modelo novedoso de la Ley Fintech para operar el mercado secundario sin licencia adicional inicial.
2. **Convenio con Casa de Bolsa**: para custodia y liquidación; permite operar bajo paraguas regulado existente.
3. **Auditoría de smart contracts**: requerimiento para producción (firmas tipo OpenZeppelin, Halborn).
4. **Reporte automático a CNBV**: indexer alimenta reportes mensuales con eventos on-chain.

## Stack regulatorio embebido

```
Smart Contract              Requisito regulatorio
─────────────────────       ──────────────────────────────────
IdentityRegistry            KYC/AML obligatorio
ClaimIssuer                 Trazabilidad de quién verificó
HoldingPeriodModule         Lockup por instrumento
MaxHoldersModule            Límite de inversionistas por oferta
JurisdictionModule          Restricción a residentes MX
MaxInvestmentModule         Topes por inversionista no calificado
SecurityToken.freeze        Cumplimiento de órdenes judiciales
SecurityToken.forced        Recovery (key loss / heredero)
SecurityToken.pause         Suspensión emergencia
Audit log (events)          Trazabilidad inmutable
```
