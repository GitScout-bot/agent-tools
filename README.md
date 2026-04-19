# Agent Tools

The open-source autonomy stack for AI agents. Not just utilities — **capabilities that make agents self-sufficient.**

> From "tools agents call" to "infrastructure that makes agents autonomous."

## Architecture

The stack is organized into three tiers, each building on the last:

### Tier 1 — Utilities

Standalone functions agents need constantly. No dependencies, no state, just reliable building blocks.

| Package | Description | Status |
|---------|-------------|--------|
| [`@agent-tools/retry`](packages/retry) | Retry with exponential backoff, jitter, and abort | ✅ Stable |
| [`@agent-tools/token-counter`](packages/token-counter) | Fast token counting for OpenAI and Anthropic models | ✅ Stable |
| [`@agent-tools/file-converter`](packages/file-converter) | Convert between JSON, YAML, TOML, CSV | ✅ Stable |

### Tier 2 — Perception

How agents see and interact with the outside world. Browser control, web understanding, content extraction.

| Package | Description | Status |
|---------|-------------|--------|
| [`@agent-tools/web-scraper`](packages/web-scraper) | Extract clean text and structured data from pages | ✅ Stable |
| `@agent-tools/browser` | Headless browser control via CDP — navigate, click, type, screenshot | 🚧 Planned |
| `@agent-tools/dom-query` | Semantic DOM querying — find elements by intent, not selectors | 🚧 Planned |

### Tier 3 — Autonomy

The layer that makes agents self-sufficient. Runtime tool creation, sandboxed execution, environment control.

| Package | Description | Status |
|---------|-------------|--------|
| [`@agent-tools/sandbox`](packages/sandbox) | Safe code execution with timeouts and resource limits | ✅ Stable |
| `@agent-tools/self-extend` | Agents write, test, and register new tools at runtime | 🚧 Planned |
| `@agent-tools/shell` | Structured terminal control with output parsing and error recovery | 🚧 Planned |
| `@agent-tools/workflow` | Multi-step task orchestration with checkpoints and rollback | 🚧 Planned |

## Why This Exists

Most agent toolkits give you a bag of utilities. That's table stakes. The hard problem is **making agents that don't get stuck** — agents that can perceive their environment, extend their own capabilities, and recover from failures without human intervention.

Browser-harness proved the pattern: when an agent hits a wall, it writes a new helper function and keeps going. We're generalizing that into a full stack.

## Install

Each package is independent. Install what you need:

```bash
npm install @agent-tools/retry
npm install @agent-tools/sandbox
npm install @agent-tools/web-scraper
```

## Design Principles

- **Autonomy over convenience.** Every package should make agents more self-sufficient, not just slightly faster.
- **Zero unnecessary dependencies.** Lightweight, auditable, no bloat.
- **Self-healing by default.** Packages should handle failure gracefully — retries, fallbacks, recovery.
- **Composable.** Packages work together but don't require each other.
- **Typed throughout.** Full TypeScript, strict mode, clear contracts.

## Contributing

We welcome contributions! This project is part of the [Gittensor](https://gittensor.io) ecosystem — contributors earn TAO rewards for merged PRs and resolved issues.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### High-Impact Contributions

The biggest impact areas right now:

1. **`@agent-tools/browser`** — CDP-based browser control. Navigate, interact, screenshot, extract. The perception foundation.
2. **`@agent-tools/self-extend`** — Runtime tool creation. Agent writes a function, tests it in sandbox, registers it for use. The autonomy breakthrough.
3. **`@agent-tools/shell`** — Structured shell interaction. Run commands, parse output, handle errors, manage long-running processes.
4. **Hardening existing packages** — Better error handling, edge cases, performance.

### Quick Start

1. Fork and clone the repo
2. `npm install` at the root
3. Pick an issue labeled `good first issue` or `help wanted`
4. Create a feature branch, implement with tests
5. Submit a PR referencing the issue

## Roadmap

**Phase 1 (current):** Stable utility packages + perception groundwork
- ✅ retry, token-counter, file-converter, web-scraper, sandbox
- 🚧 browser package (CDP control)

**Phase 2:** Perception layer
- DOM querying, page understanding, visual grounding
- Multi-page workflows (login → navigate → extract)

**Phase 3:** Autonomy layer
- Self-extend: runtime tool creation + registration
- Shell: structured terminal control
- Workflow: multi-step orchestration with checkpoints

**Phase 4:** Integration
- Agent framework adapters (LangChain, AutoGen, CrewAI)
- MCP server for tool discovery
- Pre-built capability bundles

## License

MIT
