# Agent Tools

**npm packages for AI agent developers.** Each package solves one problem, installs independently, and has zero framework lock-in.

Built by agents, for agents. Part of the [Gittensor](https://gittensor.io) ecosystem — contributors earn TAO rewards for merged PRs.

---

## Packages

### [@agent-tools/retry](packages/retry)
Retry with exponential backoff, jitter, and abort support. Designed for LLM API calls that fail transiently.

```bash
npm install @agent-tools/retry
```

```ts
import { retry } from "@agent-tools/retry";

const response = await retry(() => callLLM(prompt), {
  maxAttempts: 5,
  jitter: true,
  retryIf: (err) => err.status === 429,
});
```

---

### [@agent-tools/token-counter](packages/token-counter)
Fast token estimation for OpenAI and Anthropic models. Truncate, split, and check context window fit — zero dependencies.

```bash
npm install @agent-tools/token-counter
```

```ts
import { estimateTokens, truncateToTokenLimit, fitsInContext } from "@agent-tools/token-counter";

const count = estimateTokens(longDocument);
const trimmed = truncateToTokenLimit(longDocument, 4096);
const ok = fitsInContext("Hello!", "gpt-4");
```

---

### [@agent-tools/web-scraper](packages/web-scraper)
Extract clean text, links, headings, and metadata from web pages. Regex-based HTML parsing with zero runtime dependencies.

```bash
npm install @agent-tools/web-scraper
```

```ts
import { scrape } from "@agent-tools/web-scraper";

const page = await scrape("https://example.com");
console.log(page.text);      // Clean text content
console.log(page.links);     // [{ url, text }, ...]
console.log(page.metadata);  // { title, description, ... }
```

---

### [@agent-tools/sandbox](packages/sandbox)
Safe code execution with timeouts and resource limits. Three isolation levels for running untrusted code.

```bash
npm install @agent-tools/sandbox
```

```ts
import { execute } from "@agent-tools/sandbox";

const result = await execute('console.log(2 + 2)', { timeout: 3000 });
console.log(result.stdout);   // "4\n"
console.log(result.exitCode); // 0
```

---

### [@agent-tools/file-converter](packages/file-converter)
Convert between JSON, YAML, and CSV. Auto-detect format. Zero dependencies.

```bash
npm install @agent-tools/file-converter
```

```ts
import { convert, detectFormat } from "@agent-tools/file-converter";

const yaml = convert('{"name": "Alice"}', "json", "yaml");
const fmt = detectFormat(input); // "json" | "yaml" | "csv" | null
```

---

## What's Next

These packages are open for contribution. Pick one and build it:

| Package | What it does | Issue |
|---------|-------------|-------|
| `@agent-tools/browser` | Headless browser control via CDP | [#44](https://github.com/GitScout-bot/agent-tools/issues/44) |
| `@agent-tools/self-extend` | Agents write + register tools at runtime | [#45](https://github.com/GitScout-bot/agent-tools/issues/45) |
| `@agent-tools/shell` | Structured terminal control with output parsing | [#46](https://github.com/GitScout-bot/agent-tools/issues/46) |
| `@agent-tools/dom-query` | Find DOM elements by intent, not selectors | [#47](https://github.com/GitScout-bot/agent-tools/issues/47) |
| `@agent-tools/workflow` | Multi-step orchestration with rollback | [#48](https://github.com/GitScout-bot/agent-tools/issues/48) |

## Design Principles

- **One package, one problem.** No monoliths, no frameworks.
- **Zero unnecessary dependencies.** Most packages use only Node.js built-ins.
- **Agent-first.** Every package exists because agents need it — not because it's a fun exercise.
- **TypeScript-first.** Strict mode, full types, clear interfaces.

## Contributing

This project uses [Gittensor](https://gittensor.io) (Bittensor Subnet 74). Open an issue, submit a PR, and earn TAO rewards for quality contributions.

```bash
git clone https://github.com/GitScout-bot/agent-tools.git
cd agent-tools && npm install
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

## License

MIT
