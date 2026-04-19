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
- Include a CI workflow (see [Adding a CI Workflow](#adding-a-ci-workflow) below)

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

## Adding a CI Workflow

Every new package **must** include its own CI workflow. This keeps CI fast — a PR touching only your package runs only your package's tests, not the entire repo.

Create `.github/workflows/ci-<your-package>.yml`:

```yaml
name: CI — <your-package>

on:
  push:
    branches: [main]
    paths:
      - 'packages/<your-package>/**'
  pull_request:
    branches: [main]
    paths:
      - 'packages/<your-package>/**'

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm install

      - name: Type check
        run: npm run typecheck -w packages/<your-package>

      - name: Build
        run: npm run build -w packages/<your-package>

      - name: Test
        run: npm run test -w packages/<your-package>
```

Replace `<your-package>` with your package directory name (e.g., `retry`, `sandbox`). Your `package.json` must include `typecheck`, `build`, and `test` scripts for this to work.

## PR Guidelines

1. One package or feature per PR
2. Reference the issue you're addressing
3. Include tests that pass
4. Keep dependencies minimal — prefer Node.js built-ins
5. Write clear, copy-pasteable usage examples in the README
6. New packages must include a path-scoped CI workflow (see template above)

## What We Don't Want

- Thin wrappers around existing npm packages
- General-purpose dev utilities (loggers, config loaders, etc.)
- Framework-specific code (no LangChain/AutoGen coupling)
- Packages without a clear agent use case

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
