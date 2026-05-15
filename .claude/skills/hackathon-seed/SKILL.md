---
name: hackathon-seed
description: Seed demo data for the hackathon demo — create 3 demo investors with KYC, deploy a sample SecurityToken via TokenFactory, mint initial supply, and post a couple of orders so the orderbook is non-empty when judges open the app. Use when the user asks to "seed", "load demo data", "prep the demo", or right after a fresh deploy.
---

# Skill — Seed demo data for the hackathon

## Preconditions

- `.env` has the deployed contract addresses (run hackathon-deploy first if not).
- `docker compose up -d` has Postgres + Redis running.
- The web app and indexer are stopped or not strictly necessary — the script writes directly via the SDK + Postgres.

## Demo personas

| Persona | Wallet env var | Role |
|---------|----------------|------|
| Issuer (Arkangeles) | `DEPLOYER_PRIVATE_KEY` | Deploys the offering, mints initial supply |
| Inversionista A | `DEMO_INVESTOR_A_KEY` | Holds 1000 units of the demo token; will sell |
| Inversionista B | `DEMO_INVESTOR_B_KEY` | Has USDC; will buy from A |
| Compliance officer | reuses Issuer | Used for freeze/unfreeze demos |

If the `DEMO_INVESTOR_*_KEY` vars are not set, generate fresh keys with `viem`'s `generatePrivateKey`, write them back to `.env`, and report so the user can fund them with Fuji AVAX.

## Steps

1. **Verify wallets are funded** with at least 0.05 AVAX each.
2. **Mint MockUSDC** to Inversionista B (and a small amount to A for gas if needed).
3. **Register identities** for all three on `IdentityRegistry`:
   - Jurisdiction MX (484), `accredited = true`, valid claim hash.
4. **Deploy a demo offering** via `TokenFactory.deployToken("Cafetería La Roma", "CAFE", issuer)`.
5. **Configure compliance modules** for the new token: lockup until `now + 1 hour` (so demo can show pre/post lockup), max 99 holders, allowed jurisdictions = MX.
6. **Mint** 1000 CAFE to Inversionista A.
7. **Inversionista A approves** the Settlement contract for transfer.
8. **Sign and POST** a sell order from A: 100 CAFE @ 50 USDC.
9. **Inversionista B approves** USDC for the Settlement contract.
10. (Optional) **Sign a buy order** from B at the same price so the matcher can immediately fill it during the live demo, OR leave it for the live demo to do interactively.

## Report

```
Seed complete
  Token deployed:   CAFE @ 0x...
  Holders:          A (1000), B (0)
  USDC balances:    A (0), B (10000)
  Open orders:      1 sell (A → 100 CAFE @ 50 USDC)
  Lockup expires:   <timestamp>
  Demo URL:         http://localhost:3000
```

## Failure handling

- If `IdentityRegistry.registerIdentity` reverts with "not agent": the deployer is not registered as agent. Run a one-time setup that calls `addAgent(deployerAddress)`.
- If `mint` reverts with "compliance": the receiver's identity isn't registered yet. Fix step 3 first.
- If approvals revert: check that the SecurityToken/USDC addresses in the script match the deployed ones (`.env`).
