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

## Practical examples

### Check whether a prompt fits before you call the model

```ts
import {
  estimateTokens,
  fitsInContext,
  MODEL_CONTEXT_WINDOWS,
} from "@agent-tools/token-counter";

const prompt = `
System: You are an incident response assistant.
User: Summarize the last 50 support tickets and suggest the next 3 actions.
`;

const model = "gpt-4o";
const reserveForResponse = 1200;
const promptTokens = estimateTokens(prompt, "gpt4");

if (!fitsInContext(prompt, MODEL_CONTEXT_WINDOWS[model]!, reserveForResponse, "gpt4")) {
  throw new Error(`Prompt is too large for ${model}. Estimated prompt tokens: ${promptTokens}`);
}

console.log(`Safe to send. Estimated prompt tokens: ${promptTokens}`);
```

### Trim scraped content to an input budget

```ts
import {
  estimateTokens,
  truncateToTokenLimit,
} from "@agent-tools/token-counter";

const article = `
Acme Corp reported strong quarterly growth across Europe and APAC.
The company credited pricing discipline, new enterprise contracts, and lower churn.
Analysts now expect more hiring in the second half of the year.
`.repeat(200);

const maxInputTokens = 6000;
const trimmed = truncateToTokenLimit(article, maxInputTokens, "gpt4");

console.log("Original estimate:", estimateTokens(article, "gpt4"));
console.log("Trimmed estimate:", estimateTokens(trimmed, "gpt4"));
console.log(trimmed);
```

### Estimate cost before sending a request

```ts
import { estimateTokens } from "@agent-tools/token-counter";

const prompt = "Write release notes from these commit messages and keep them under 10 bullet points.";
const expectedResponseTokens = 800;
const model = "gpt-4o-mini";

// Example pricing only. Replace with your provider's current rates.
const pricingByModel = {
  "gpt-4o-mini": {
    inputPer1KTokens: 0.001,
    outputPer1KTokens: 0.003,
  },
};

const inputTokens = estimateTokens(prompt, "gpt4");
const inputCost = (inputTokens / 1000) * pricingByModel[model].inputPer1KTokens;
const outputCost =
  (expectedResponseTokens / 1000) * pricingByModel[model].outputPer1KTokens;
const totalCost = inputCost + outputCost;

console.log(`Estimated input tokens: ${inputTokens}`);
console.log(`Estimated request cost: $${totalCost.toFixed(4)}`);
```

### Split a long document into model-sized chunks

```ts
import { splitByTokenLimit } from "@agent-tools/token-counter";

const runbook = `
# Incident timeline

09:00 Service degradation detected
09:15 Error rate crossed 5%
09:30 Rollback started

# Notes

Customer reports were concentrated in the payments flow.
Logs suggest a bad deploy reached two regions before rollback completed.
`.repeat(80);

const chunks = splitByTokenLimit(runbook, 1200, "gpt4");

console.log(`Created ${chunks.length} chunks`);
console.log(chunks[0]);
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
