# @agent-tools/token-counter

Fast, dependency-free token estimation for OpenAI and Anthropic models.

> **Note:** This library uses character-based heuristics, not a real BPE tokenizer like tiktoken. Estimates are calibrated to be close but may differ from exact counts by 5-15%. Use this when you need speed and zero dependencies over precision.

## Installation

```bash
npm install @agent-tools/token-counter
```

## Usage

```ts
import {
  estimateTokens,
  truncateToTokenLimit,
  splitByTokenLimit,
  fitsInContext,
  MODEL_CONTEXT_WINDOWS,
} from "@agent-tools/token-counter";

// Estimate token count
const count = estimateTokens("Hello, world!");
// => ~4

// Estimate for a specific model family
const claudeCount = estimateTokens("Hello, world!", "claude");

// Truncate text to fit a token budget
const truncated = truncateToTokenLimit(longDocument, 4096, "gpt4");

// Split text into chunks that each fit within a limit
const chunks = splitByTokenLimit(longDocument, 2048);

// Check if text fits in a model's context window
if (fitsInContext(prompt, MODEL_CONTEXT_WINDOWS["gpt-4o"]!, 1000)) {
  // 1000 tokens reserved for the response
}
```

## API

### `estimateTokens(text, model?)`

Returns an estimated token count. Model families: `"claude"`, `"gpt4"`, `"gpt3.5"`, `"general"` (default).

### `truncateToTokenLimit(text, maxTokens, model?)`

Truncates text to fit within `maxTokens`, breaking at word boundaries when possible.

### `splitByTokenLimit(text, maxTokens, model?)`

Splits text into chunks of at most `maxTokens` each, preferring paragraph and line boundaries.

### `fitsInContext(text, contextWindow, reserveTokens?, model?)`

Returns `true` if the estimated token count fits within `contextWindow - reserveTokens`.

### `MODEL_CONTEXT_WINDOWS`

A `Record<string, number>` mapping model names to their context window sizes in tokens.

## License

MIT
