import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import {
  estimateTokens,
  truncateToTokenLimit,
  splitByTokenLimit,
  fitsInContext,
  MODEL_CONTEXT_WINDOWS,
} from "../counter.js";
import type { ModelFamily } from "../counter.js";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    assert.equal(estimateTokens(""), 0);
  });

  it("returns at least 1 for non-empty string", () => {
    assert.ok(estimateTokens("a") >= 1);
  });

  it("returns reasonable count for a known sentence", () => {
    // "The quick brown fox jumps over the lazy dog" is ~10 tokens in most tokenizers
    const text = "The quick brown fox jumps over the lazy dog";
    const tokens = estimateTokens(text);
    assert.ok(tokens >= 8, `Expected >= 8, got ${tokens}`);
    assert.ok(tokens <= 15, `Expected <= 15, got ${tokens}`);
  });

  it("scales roughly linearly with text length", () => {
    const short = "Hello world";
    const long = "Hello world ".repeat(100);
    const shortTokens = estimateTokens(short);
    const longTokens = estimateTokens(long);
    const ratio = longTokens / shortTokens;
    // Should be roughly 100x (within a factor of 2)
    assert.ok(ratio > 50, `Expected ratio > 50, got ${ratio}`);
    assert.ok(ratio < 150, `Expected ratio < 150, got ${ratio}`);
  });

  it("defaults to general model family", () => {
    const text = "Some sample text for estimation.";
    const general = estimateTokens(text, "general");
    const defaultResult = estimateTokens(text);
    assert.equal(defaultResult, general);
  });
});

describe("model family differences", () => {
  it("different model families produce different estimates for the same text", () => {
    const text =
      "This is a moderately long piece of text that should show differences between model family estimates when counting tokens.";
    const families: ModelFamily[] = ["claude", "gpt4", "gpt3.5", "general"];
    const estimates = families.map((f) => estimateTokens(text, f));

    // Not all should be equal — at least two distinct values
    const unique = new Set(estimates);
    assert.ok(
      unique.size >= 2,
      `Expected at least 2 distinct estimates, got values: ${estimates.join(", ")}`,
    );
  });

  it("claude estimates more tokens than general for same text", () => {
    // Claude has a lower chars-per-token ratio, so same text = more tokens
    const text = "A reasonably long sentence to compare token estimates across model families.";
    const claude = estimateTokens(text, "claude");
    const general = estimateTokens(text, "general");
    assert.ok(
      claude >= general,
      `Expected claude (${claude}) >= general (${general})`,
    );
  });
});

describe("truncateToTokenLimit", () => {
  it("returns original text if under limit", () => {
    const text = "Short text.";
    const result = truncateToTokenLimit(text, 1000);
    assert.equal(result, text);
  });

  it("truncates long text", () => {
    const text = "word ".repeat(500);
    const result = truncateToTokenLimit(text, 10);
    assert.ok(result.length < text.length, "Should be shorter than original");
    const resultTokens = estimateTokens(result);
    assert.ok(
      resultTokens <= 12, // small buffer for rounding
      `Expected truncated text to be around 10 tokens, got ${resultTokens}`,
    );
  });

  it("returns empty string for maxTokens of 0", () => {
    assert.equal(truncateToTokenLimit("Hello world", 0), "");
  });

  it("does not split words when possible", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel india juliet";
    const result = truncateToTokenLimit(text, 3);
    // Should end at a word boundary (no partial words)
    assert.ok(
      !result.endsWith(" "),
      "Should not end with trailing space",
    );
    const words = result.split(/\s+/);
    for (const word of words) {
      assert.ok(
        text.includes(word),
        `Word "${word}" should be a complete word from original`,
      );
    }
  });
});

describe("splitByTokenLimit", () => {
  it("returns single chunk if text fits", () => {
    const text = "Short text.";
    const chunks = splitByTokenLimit(text, 1000);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], text);
  });

  it("splits long text into multiple chunks", () => {
    const text = "word ".repeat(500);
    const chunks = splitByTokenLimit(text, 20);
    assert.ok(chunks.length > 1, `Expected multiple chunks, got ${chunks.length}`);
  });

  it("each chunk fits within the token limit", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(100);
    const maxTokens = 30;
    const chunks = splitByTokenLimit(text, maxTokens);

    for (let i = 0; i < chunks.length; i++) {
      const tokens = estimateTokens(chunks[i]!);
      assert.ok(
        tokens <= maxTokens + 2, // small tolerance for rounding
        `Chunk ${i} has ${tokens} tokens, expected <= ${maxTokens + 2}`,
      );
    }
  });

  it("returns empty array for maxTokens of 0", () => {
    assert.deepEqual(splitByTokenLimit("Hello world", 0), []);
  });

  it("returns empty array for empty text", () => {
    assert.deepEqual(splitByTokenLimit("", 10), []);
  });

  it("preserves all content (no data loss)", () => {
    const text = "one two three four five six seven eight nine ten ".repeat(20);
    const chunks = splitByTokenLimit(text, 15);
    const reassembled = chunks.join(" ");
    // All words from the original should appear in the reassembled output
    const originalWords = text.trim().split(/\s+/);
    for (const word of originalWords) {
      assert.ok(
        reassembled.includes(word),
        `Missing word "${word}" after split`,
      );
    }
  });
});

describe("fitsInContext", () => {
  it("returns true for short text in large context", () => {
    assert.equal(fitsInContext("Hello", 100_000), true);
  });

  it("returns false for long text in small context", () => {
    const longText = "word ".repeat(10_000);
    assert.equal(fitsInContext(longText, 100), false);
  });

  it("accounts for reserved tokens", () => {
    const text = "word ".repeat(100);
    const tokens = estimateTokens(text);
    // Fits without reserve
    assert.equal(fitsInContext(text, tokens + 10), true);
    // Does not fit with large reserve
    assert.equal(fitsInContext(text, tokens + 10, tokens + 20), false);
  });

  it("returns false when reserve exceeds context window", () => {
    assert.equal(fitsInContext("Hello", 100, 200), false);
  });
});

describe("MODEL_CONTEXT_WINDOWS", () => {
  it("contains known models", () => {
    assert.ok("gpt-4" in MODEL_CONTEXT_WINDOWS);
    assert.ok("gpt-4o" in MODEL_CONTEXT_WINDOWS);
    assert.ok("claude-3-opus" in MODEL_CONTEXT_WINDOWS);
    assert.ok("claude-3.5-sonnet" in MODEL_CONTEXT_WINDOWS);
  });

  it("all values are positive integers", () => {
    for (const [model, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      assert.ok(
        Number.isInteger(size) && size > 0,
        `${model} has invalid context window: ${size}`,
      );
    }
  });
});
