---
name: hackathon-deploy
description: Deploy the IFC secondary market contracts (IdentityRegistry, ComplianceRegistry, modules, TokenFactory, Settlement, MockUSDC) to Avalanche Fuji testnet, verify them, and write the resulting addresses into the project .env so the frontend and indexer pick them up. Use when the user asks to deploy, redeploy, push contracts to testnet, or "deploy to Fuji".
---

# Skill — Deploy contracts to Avalanche Fuji

## Preconditions

Before invoking the actual deploy:

1. Confirm the user has `DEPLOYER_PRIVATE_KEY` set in `.env` and the address has Fuji AVAX (faucet: https://faucet.avax.network).
2. Confirm `pnpm install` has been run (look for `node_modules`).
3. Run `pnpm --filter @hack/contracts compile` first; abort if compilation fails.
4. Run `pnpm --filter @hack/contracts test` and only proceed if green. If any test fails, stop and report — do not deploy broken contracts.

## Steps

1. From the repo root: `pnpm --filter @hack/contracts deploy:fuji`
2. Capture stdout. The deploy script prints addresses for: `IdentityRegistry`, `ComplianceRegistry`, `TokenFactory`, `MockUSDC`, `Settlement`.
3. Update `.env` (root) with:
   ```
   NEXT_PUBLIC_IDENTITY_REGISTRY=0x...
   NEXT_PUBLIC_COMPLIANCE_REGISTRY=0x...
   NEXT_PUBLIC_TOKEN_FACTORY=0x...
   NEXT_PUBLIC_SETTLEMENT=0x...
   NEXT_PUBLIC_USDC=0x...
   ```
4. (Optional) Verify on Snowtrace: `pnpm --filter @hack/contracts hardhat verify --network fuji <address>` for each contract that benefits from public source. Skip MockUSDC.
5. Print a summary block:
   ```
   Deployed to Fuji (chainId 43113):
     IdentityRegistry   0x...
     ComplianceRegistry 0x...
     TokenFactory       0x...
     Settlement         0x...
     MockUSDC           0x...

   Snowtrace links:
     https://testnet.snowtrace.io/address/0x...
     ...
   ```

## After deploy

- Restart the indexer if it's running (`apps/indexer`) — it caches addresses at startup.
- Restart `pnpm --filter @hack/web dev` so the new env vars are picked up.
- Verify in the frontend that the offerings list loads (will be empty but should not 404).

## Failure handling

- "insufficient funds": tell the user to fund `DEPLOYER_PRIVATE_KEY` from the Fuji faucet.
- "nonce too low": likely a stuck pending tx. Suggest waiting 30s and retrying.
- Compilation error: do NOT deploy. Hand the error to the solidity-engineer agent.
