# Contributing to Agent Tools

The open-source autonomy stack for AI agents. This project is part of the [Gittensor](https://gittensor.io) ecosystem (Bittensor Subnet 74). Quality contributions can earn TAO rewards.

## Architecture

The repo is organized into three tiers. When choosing what to work on, higher tiers have more impact:

| Tier | Focus | Examples | Impact |
|------|-------|----------|--------|
| **Tier 3: Autonomy** | Self-extension, shell control, orchestration | `@agent-tools/self-extend`, `@agent-tools/shell`, `@agent-tools/workflow` | Highest |
| **Tier 2: Perception** | Browser, DOM, web understanding | `@agent-tools/browser`, `@agent-tools/dom-query` | High |
| **Tier 1: Utilities** | Standalone helpers | `@agent-tools/retry`, `@agent-tools/token-counter` | Foundation |

**High-impact issues** are labeled `high-impact` — these are the packages that define the project's direction.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/<your-username>/agent-tools.git`
3. **Install** dependencies: `npm install`
4. **Build** all packages: `npm run build`
5. **Test** all packages: `npm run test`

## Finding Work

- Issues labeled `high-impact` are the most valuable contributions
- Issues labeled `good first issue` are great starting points
- Issues labeled `help wanted` need contributors
- Filter by tier: `tier:autonomy`, `tier:perception`, `tier:utility`
- Feel free to propose new packages by opening an issue first

### Free-for-All — No Claims

Issues are never "claimed." There's no assignment, no dibs, no locking. Multiple people can work on the same issue simultaneously. **The first PR that passes automated checks and meets quality standards gets merged.** Everyone else closes theirs.

This rewards speed *and* quality. Don't rush garbage — but don't sit on it either. If you see an issue you want, start building immediately. The race is on.

## Pull Request Process

1. **One PR per issue.** Keep changes focused and reviewable.
2. **Branch from `main`.** Name your branch descriptively: `feat/tool-name`, `fix/issue-description`.
3. **Write tests.** Every new function needs tests. Every bug fix needs a regression test.
4. **Run checks locally** before submitting:
   ```bash
   npm run build
   npm run test
   npm run typecheck
   ```
5. **Write a clear PR description.** Explain what changed and why.
6. **Reference the issue.** Your PR body **must** include `Closes #N` (or `Fixes #N` / `Resolves #N`). PRs without an issue reference are auto-closed.
7. **Keep commits clean.** Squash WIP commits. Use clear commit messages.

### Immutable PR Policy

**PRs are reviewed exactly once, as submitted. This is non-negotiable.**

- When you open a PR, that snapshot is what gets reviewed — merge or close, no middle ground.
- **Any additional commits pushed after opening will auto-close your PR.**
- There is no back-and-forth iteration. No "can you fix this one thing." If the PR isn't ready, it gets closed.
- To iterate: close the old PR, fix your code, open a new one.

**Why?** This keeps reviews fast, fair, and honest. It forces you to test thoroughly before submitting. It prevents gaming through incremental fixes. Ship it right or ship it again.

**Before you open your PR, make sure:**
- All tests pass (`npm test`)
- Types check (`npm run typecheck`)
- Build succeeds (`npm run build`)
- You've manually verified your code works
- Your PR description is complete

## Code Style

- TypeScript with strict mode
- No `any` types unless absolutely necessary (and documented why)
- Functions should have explicit return types
- Prefer `const` over `let`
- Use descriptive variable names — no single-letter variables outside of loop counters
- No comments explaining *what* — only *why* when non-obvious

## Package Structure

Every package follows this structure:

```
packages/<tool-name>/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts          # Public API exports
│   ├── <module>.ts       # Implementation
│   └── __tests__/
│       └── <module>.test.ts
```

### Design Principles for Agent Packages

Packages in this repo are consumed by AI agents, not just humans. Keep these principles in mind:

- **Deterministic outputs.** Same inputs → same outputs. Agents can't debug flaky behavior.
- **Minimal configuration.** Sane defaults, few required options. Agents work best with simple APIs.
- **Structured errors.** Throw typed errors with codes, not string messages. Agents parse error types, not prose.
- **Self-contained.** Minimize external dependencies. Agents operate in constrained environments.
- **Composable.** Packages should work together. A `browser` action feeds into `dom-query` which feeds into `workflow`.

## Quality Standards

- **Tests must pass.** No exceptions.
- **Type-check must pass.** No `@ts-ignore` without explanation.
- **No unnecessary dependencies.** If you can implement it in 50 lines, don't add a dependency.
- **API must be agent-friendly.** Clear function signatures, predictable returns, no ambiguous options.

## Code of Conduct

Be respectful, constructive, and collaborative. We're building tools that help everyone. Harassment, trolling, or unconstructive criticism will not be tolerated.

## Questions?

Open an issue with the `question` label or start a [discussion](../../discussions).
