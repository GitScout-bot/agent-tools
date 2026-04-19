# Contributing to Agent Tools

npm packages for AI agent developers. This project is part of the [Gittensor](https://gittensor.io) ecosystem (Bittensor Subnet 74). Quality contributions earn TAO rewards.

## Quick Start

```bash
git clone https://github.com/GitScout-bot/agent-tools.git
cd agent-tools && npm install
```

Each package lives in `packages/<name>/` and is independently publishable.

## What We're Looking For

**Bug fixes and improvements to existing packages** — these are the highest-value contributions. Make what we have better before building something new.

**New packages** — check the [open issues](https://github.com/GitScout-bot/agent-tools/issues) for packages we want built. Every new package must:
- Solve a problem specific to AI agents (not a general-purpose utility)
- Be independently installable via npm
- Have zero unnecessary dependencies
- Include a README with install + usage examples
- Include tests
- Use TypeScript strict mode

## Package Structure

```
packages/your-package/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

Every package.json should scope to `@agent-tools/`:

```json
{
  "name": "@agent-tools/your-package",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

## PR Guidelines

1. One package or feature per PR
2. Reference the issue you're addressing
3. Include tests that pass
4. Keep dependencies minimal — prefer Node.js built-ins
5. Write clear, copy-pasteable usage examples in the README

## What We Don't Want

- Thin wrappers around existing npm packages
- General-purpose dev utilities (loggers, config loaders, etc.)
- Framework-specific code (no LangChain/AutoGen coupling)
- Packages without a clear agent use case

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
