# CLAUDE.md — Project guidance for Claude Code

This file is loaded into every Claude Code session opened in this repo. Keep it tight.

## What this project is

**Arca** — mercado secundario regulado de participaciones IFC sobre Avalanche, con compliance CNBV embebido a nivel de smart contract. Cliente piloto: Arkangeles. Stack: Next.js + TypeScript + Hardhat + Solidity + viem.

Brand convention: **ARCA** (all caps) for logo/wordmark and large headers; **Arca** (title case) for body text, descriptions, and toast messages.

Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design and [docs/](./docs/) for compliance and trading flows.

## Repo layout

```
apps/web        Next.js (UI + API routes)
apps/indexer    Worker that mirrors on-chain events to Postgres
packages/contracts   Solidity (Hardhat)
packages/shared      Shared TS types
packages/sdk         viem-based client + EIP-712 schema
packages/ui          Shared React components
docs/                Architecture, compliance, trading, regulatory
```

## Use the agents — don't do everything in main

This repo defines specialized subagents under `.claude/agents/`. **Delegate** to them when the task fits:

| Agent                 | Scope                                                     |
| --------------------- | --------------------------------------------------------- |
| `solidity-engineer`   | Anything under `packages/contracts/`                      |
| `frontend-engineer`   | Anything under `apps/web/` and `packages/ui/`             |
| `backend-engineer`    | API routes, Prisma, KYC, matching engine, indexer         |
| `compliance-reviewer` | Read-only review before merge of regulator-facing changes |
| `pitch-builder`       | Pitch deck, demo script, judge-facing artifacts           |

Spawn multiple in parallel when the work is independent (e.g., contract change + matching frontend update).

## Use the skills — don't reinvent

Project-specific skills:

- `/hackathon-deploy` — deploy contracts to Avalanche Fuji and update `.env`
- `/hackathon-test` — run tests + type-checks across the whole monorepo
- `/hackathon-seed` — seed demo data (demo investors, token, orders)

Design skills (from ui-ux-pro-max collection): `ui-ux-pro-max`, `ui-styling`, `design`, `design-system`, `slides`, `brand`, `banner-design`. Use them when designing UI, picking palettes/fonts, or building slides — don't guess.

## Hard rules

- Solidity 0.8.24, viaIR enabled. Never downgrade.
- Every transfer path in `SecurityToken` must call `compliance.canTransfer` and emit `Transfer`.
- Every admin endpoint in the backend writes to `audit_log` BEFORE calling the chain.
- Every order POST verifies the EIP-712 signature; never trust `maker` from the body.
- No PII (RFC, CURP, names, emails) in logs.
- Spanish first in user-facing copy. English fine in code/comments.

## Commands worth remembering

```bash
pnpm install                              # one-time
docker compose up -d                      # Postgres + Redis local
pnpm --filter @hack/contracts compile
pnpm --filter @hack/contracts test
pnpm --filter @hack/contracts deploy:fuji
pnpm dev                                  # web + indexer in parallel
```

## When in doubt

Re-read [ARCHITECTURE.md](./ARCHITECTURE.md) section 4 (contracts) and section 5 (flows) before making non-trivial changes. The architecture is the source of truth; if code drifts from it, fix the code or update the doc — don't let them disagree silently.
