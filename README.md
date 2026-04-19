# Agent Tools

A collection of standalone, well-tested tools for AI agents. Each package is independent, minimal, and designed to solve one problem well.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@agent-tools/retry`](packages/retry) | Retry with exponential backoff, jitter, and abort support | ✅ Stable |
| [`@agent-tools/token-counter`](packages/token-counter) | Fast token counting for OpenAI and Anthropic models | ✅ Stable |
| [`@agent-tools/web-scraper`](packages/web-scraper) | Extract clean text and structured data from web pages | ✅ Stable |
| [`@agent-tools/file-converter`](packages/file-converter) | Convert between common file formats (JSON, YAML, TOML, CSV) | ✅ Stable |
| [`@agent-tools/sandbox`](packages/sandbox) | Safe code execution with timeouts and resource limits | ✅ Stable |

## Install

Each package is published independently. Install only what you need:

```bash
npm install @agent-tools/retry
npm install @agent-tools/token-counter
```

## Design Principles

- **One tool, one job.** Each package solves a single, well-defined problem.
- **Zero unnecessary dependencies.** Packages are lightweight and avoid dependency bloat.
- **Typed throughout.** Full TypeScript with strict mode. Every function has clear input/output types.
- **Tested thoroughly.** Every package ships with comprehensive tests. PRs require passing tests.
- **Agent-first API design.** APIs are designed to be easy for AI agents to use programmatically — clear function signatures, predictable return types, no ambiguous options.

## Contributing

We welcome contributions! This project is part of the [Gittensor](https://gittensor.io) ecosystem — contributors can earn TAO rewards for merged PRs and resolved issues.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

1. Fork and clone the repo
2. `npm install` at the root
3. Pick an issue labeled `good first issue` or `help wanted`
4. Create a feature branch, implement your changes with tests
5. Submit a PR referencing the issue

## Adding a New Tool

Want to add a new tool? Check the [open issues](../../issues) for tool requests, or propose your own:

1. Create `packages/<tool-name>/` with the standard structure (see any existing package)
2. Include `package.json`, `tsconfig.json`, `src/index.ts`, and `src/__tests__/`
3. Write comprehensive tests
4. Add a `README.md` for the package
5. Update the root README table

## License

MIT
