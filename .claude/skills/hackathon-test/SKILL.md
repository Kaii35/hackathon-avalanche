---
name: hackathon-test
description: Run the full test and type-check pipeline across the monorepo — Hardhat tests for contracts, TypeScript type-check for web/indexer/sdk/shared/ui, and Next.js lint. Use when the user asks to "run tests", "check the build", "verify nothing is broken", or before a commit/push.
---

# Skill — Run all tests across the monorepo

## Steps

Run these in order. Stop and report on the first failure — don't continue silently.

1. **Smart contract tests** (most important; cover compliance logic):
   ```bash
   pnpm --filter @hack/contracts compile
   pnpm --filter @hack/contracts test
   ```

2. **Type-check shared types**:
   ```bash
   pnpm --filter @hack/shared type-check
   ```

3. **Type-check the SDK**:
   ```bash
   pnpm --filter @hack/sdk type-check
   ```

4. **Type-check the UI package**:
   ```bash
   pnpm --filter @hack/ui type-check
   ```

5. **Type-check + lint the web app**:
   ```bash
   pnpm --filter @hack/web type-check
   pnpm --filter @hack/web lint
   ```

6. **Type-check the indexer**:
   ```bash
   pnpm --filter @hack/indexer type-check
   ```

## Report

Summarize at the end:

```
Test report
-----------
contracts:  PASS (N tests, X gas-reported)
shared:     PASS
sdk:        PASS
ui:         PASS
web:        PASS (lint ok)
indexer:    PASS
```

If anything fails, paste the relevant error and stop. Do not "fix" — that is the job of the relevant engineer agent.

## Speed tip

You can run the type-checks in parallel via Turbo:
```bash
pnpm turbo run type-check
```
But run contract tests serially first since they are the most likely to surface real bugs.
