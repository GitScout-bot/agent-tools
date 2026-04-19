/**
 * Fast token estimation for LLM models.
 *
 * This module provides heuristic-based token counting that is fast and
 * dependency-free. It is NOT an exact tokenizer (like tiktoken) — estimates
 * are calibrated to be close but may differ from true BPE counts.
 */

/** Supported model families for calibrated estimation. */
export type ModelFamily = "claude" | "gpt4" | "gpt3.5" | "general";

/**
 * Average characters per token, calibrated per model family.
 *
 * These ratios are derived from empirical observation on English text:
 * - GPT-4 (cl100k_base): ~3.7–4.0 chars/token
 * - GPT-3.5 (cl100k_base): ~3.7–4.0 chars/token
 * - Claude (proprietary BPE): ~3.5–3.8 chars/token (slightly more aggressive)
 * - General fallback: ~4.0 chars/token (conservative)
 */
const CHARS_PER_TOKEN: Record<ModelFamily, number> = {
  claude: 3.6,
  gpt4: 3.8,
  "gpt3.5": 3.9,
  general: 4.0,
};

/** Known context window sizes for popular models. */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic
  "claude-3-opus": 200_000,
  "claude-3-sonnet": 200_000,
  "claude-3-haiku": 200_000,
  "claude-3.5-sonnet": 200_000,
  "claude-3.5-haiku": 200_000,
  "claude-4-opus": 200_000,
  "claude-4-sonnet": 200_000,

  // OpenAI GPT-4 family
  "gpt-4": 8_192,
  "gpt-4-32k": 32_768,
  "gpt-4-turbo": 128_000,
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,

  // OpenAI GPT-3.5 family
  "gpt-3.5-turbo": 16_385,
  "gpt-3.5-turbo-16k": 16_385,

  // OpenAI o-series
  "o1": 200_000,
  "o1-mini": 128_000,
  "o3": 200_000,
  "o3-mini": 200_000,
  "o4-mini": 200_000,
};

/**
 * Estimate the number of tokens in a string.
 *
 * Uses a character-count heuristic calibrated per model family. For mixed
 * content (code, non-English, etc.) the estimate may be less accurate.
 *
 * @param text - The input text to estimate tokens for.
 * @param model - Model family for calibration (default: `"general"`).
 * @returns Estimated token count (always >= 0).
 */
export function estimateTokens(
  text: string,
  model: ModelFamily = "general",
): number {
  if (text.length === 0) return 0;

  const charsPerToken = CHARS_PER_TOKEN[model];
  const estimate = Math.ceil(text.length / charsPerToken);

  return Math.max(1, estimate);
}

/**
 * Truncate text so it fits within a token limit.
 *
 * Cuts at the character boundary that corresponds to `maxTokens` and then
 * backs up to the nearest whitespace to avoid splitting words.
 *
 * @param text - The input text to truncate.
 * @param maxTokens - Maximum number of tokens allowed.
 * @param model - Model family for calibration (default: `"general"`).
 * @returns The (possibly truncated) text.
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  model: ModelFamily = "general",
): string {
  if (maxTokens <= 0) return "";

  const currentTokens = estimateTokens(text, model);
  if (currentTokens <= maxTokens) return text;

  const charsPerToken = CHARS_PER_TOKEN[model];
  let maxChars = Math.floor(maxTokens * charsPerToken);

  // Clamp to string length
  if (maxChars >= text.length) return text;

  // Back up to nearest whitespace boundary to avoid splitting a word
  let cutPoint = maxChars;
  while (cutPoint > 0 && !/\s/.test(text[cutPoint]!)) {
    cutPoint--;
  }

  // If we couldn't find whitespace, just hard-cut at the char limit
  if (cutPoint === 0) {
    cutPoint = maxChars;
  }

  return text.slice(0, cutPoint);
}

/**
 * Split text into chunks that each fit within a token limit.
 *
 * Splits preferentially at paragraph boundaries (`\n\n`), then line breaks,
 * then whitespace. Each returned chunk is estimated to be at or below
 * `maxTokens`.
 *
 * @param text - The input text to split.
 * @param maxTokens - Maximum tokens per chunk.
 * @param model - Model family for calibration (default: `"general"`).
 * @returns Array of text chunks.
 */
export function splitByTokenLimit(
  text: string,
  maxTokens: number,
  model: ModelFamily = "general",
): string[] {
  if (maxTokens <= 0) return [];
  if (text.length === 0) return [];

  const currentTokens = estimateTokens(text, model);
  if (currentTokens <= maxTokens) return [text];

  const charsPerToken = CHARS_PER_TOKEN[model];
  const targetChars = Math.floor(maxTokens * charsPerToken);
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (estimateTokens(remaining, model) <= maxTokens) {
      chunks.push(remaining);
      break;
    }

    let cutPoint = targetChars;
    if (cutPoint > remaining.length) {
      cutPoint = remaining.length;
    }

    // Try to find a paragraph break near the cut point
    let bestBreak = findBreakPoint(remaining, cutPoint, "\n\n");

    // Fall back to line break
    if (bestBreak === -1) {
      bestBreak = findBreakPoint(remaining, cutPoint, "\n");
    }

    // Fall back to whitespace
    if (bestBreak === -1) {
      bestBreak = findBreakPointWhitespace(remaining, cutPoint);
    }

    // Hard cut as last resort
    if (bestBreak === -1 || bestBreak === 0) {
      bestBreak = cutPoint;
    }

    chunks.push(remaining.slice(0, bestBreak).trimEnd());
    remaining = remaining.slice(bestBreak).trimStart();
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Check whether text fits within a context window.
 *
 * @param text - The input text to check.
 * @param contextWindow - Total context window size in tokens.
 * @param reserveTokens - Tokens to reserve for output/system prompt (default: 0).
 * @param model - Model family for calibration (default: `"general"`).
 * @returns `true` if estimated tokens fit within the available space.
 */
export function fitsInContext(
  text: string,
  contextWindow: number,
  reserveTokens: number = 0,
  model: ModelFamily = "general",
): boolean {
  const available = contextWindow - reserveTokens;
  if (available <= 0) return false;

  return estimateTokens(text, model) <= available;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Search backwards from `cutPoint` for a substring break (e.g. "\n\n").
 * Returns the index right after the break, or -1 if not found within a
 * reasonable window (half the cut distance).
 */
function findBreakPoint(
  text: string,
  cutPoint: number,
  delimiter: string,
): number {
  const searchStart = Math.max(0, Math.floor(cutPoint / 2));
  const region = text.slice(searchStart, cutPoint);
  const idx = region.lastIndexOf(delimiter);
  if (idx === -1) return -1;
  return searchStart + idx + delimiter.length;
}

/**
 * Search backwards from `cutPoint` for the nearest whitespace character.
 */
function findBreakPointWhitespace(text: string, cutPoint: number): number {
  let i = cutPoint;
  const lowerBound = Math.max(0, Math.floor(cutPoint / 2));
  while (i > lowerBound) {
    if (/\s/.test(text[i]!)) {
      return i + 1;
    }
    i--;
  }
  return -1;
}
