# `.claude/` — Agents and skills for this project

## Agents (`.claude/agents/`)

Project-specific subagents that Claude Code can delegate to. Each one has a narrow scope and the tools it needs.

| Agent | Use when |
|-------|----------|
| [solidity-engineer](./agents/solidity-engineer.md) | Writing/testing/deploying Solidity contracts |
| [frontend-engineer](./agents/frontend-engineer.md) | Next.js UI, React, Tailwind, wallet integration |
| [backend-engineer](./agents/backend-engineer.md) | API routes, Prisma, KYC, matching, indexer |
| [compliance-reviewer](./agents/compliance-reviewer.md) | Read-only review before merging regulator-facing code |
| [pitch-builder](./agents/pitch-builder.md) | Pitch deck, demo script, non-code judge-facing assets |

Invoke from the main agent with `Task(subagent_type: "solidity-engineer", ...)` or by saying "use the solidity-engineer agent to...".

## Skills (`.claude/skills/`)

### Project-specific (custom for this hackathon)

| Skill | What it does |
|-------|--------------|
| [hackathon-deploy](./skills/hackathon-deploy/SKILL.md) | Deploy contracts to Avalanche Fuji and update `.env` |
| [hackathon-test](./skills/hackathon-test/SKILL.md) | Run tests + type-checks across the whole monorepo |
| [hackathon-seed](./skills/hackathon-seed/SKILL.md) | Seed demo data (investors, token, orders) for the live demo |

### Design skills (from ui-ux-pro-max collection)

| Skill | What it does |
|-------|--------------|
| ui-ux-pro-max | 67 styles, 161 palettes, 57 font pairings, 99 UX guidelines |
| ui-styling | shadcn/ui + Tailwind reference, accessibility, theming |
| design | Logo, icon, banner, slide design generation |
| design-system | Token architecture, primitive/semantic tokens, component specs |
| slides | Slide layouts, copywriting formulas, HTML template |
| brand | Brand guidelines, voice/messaging frameworks |
| banner-design | Banner sizes and styles |

Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT)

## How agents and skills compose

- The **main agent** (you, by default) orchestrates work.
- For chunky technical work, delegate to a **subagent** (e.g., `solidity-engineer`) — it has its own context window and a focused prompt.
- For specialized capability (UI design intelligence, slide generation), invoke a **skill** — these inject reference material into the active context when relevant.
- A subagent can also invoke skills if its `tools` field includes `Skill`. The frontend-engineer and pitch-builder agents both have it.

## Common workflows

| You ask | Right path |
|---------|------------|
| "Add the holding period check to the token" | Delegate to solidity-engineer |
| "Build the orderbook page" | Delegate to frontend-engineer; it'll invoke ui-ux-pro-max |
| "Wire the KYC webhook" | Delegate to backend-engineer |
| "Is my new mint function safe?" | Delegate to compliance-reviewer (after the change lands) |
| "Make the pitch deck" | Delegate to pitch-builder; it'll invoke slides |
| "Deploy to testnet" | Invoke `/hackathon-deploy` directly |
| "Run all the tests" | Invoke `/hackathon-test` directly |
