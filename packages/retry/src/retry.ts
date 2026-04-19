/**
 * Options for configuring retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of attempts (including the first). Defaults to 3. */
  maxAttempts?: number;
  /** Base delay in milliseconds before the first retry. Defaults to 1000. */
  baseDelay?: number;
  /** Maximum delay in milliseconds between retries. Defaults to 30000. */
  maxDelay?: number;
  /** Multiplier applied to the delay after each attempt. Defaults to 2. */
  backoffFactor?: number;
  /** Whether to add random jitter (0-100% of calculated delay). Defaults to true. */
  jitter?: boolean;
  /** Predicate that receives the thrown error; return false to stop retrying immediately. */
  retryIf?: (error: unknown) => boolean;
  /** Callback invoked before each retry with the error and upcoming attempt number. */
  onRetry?: (error: unknown, attempt: number) => void;
  /** AbortSignal to cancel the retry loop. */
  signal?: AbortSignal;
}

/**
 * Error thrown when all retry attempts have been exhausted.
 */
export class RetryError extends Error {
  /** The underlying error from the last attempt. */
  public readonly cause: unknown;
  /** Total number of attempts made. */
  public readonly attempts: number;

  constructor(message: string, cause: unknown, attempts: number) {
    super(message);
    this.name = "RetryError";
    this.cause = cause;
    this.attempts = attempts;
  }
}

/**
 * Calculate the delay for a given attempt.
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean,
): number {
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, maxDelay);

  if (jitter) {
    return Math.floor(Math.random() * clampedDelay);
  }

  return clampedDelay;
}

/**
 * Sleep for the specified duration, respecting an optional AbortSignal.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });

      // Clean up the listener when the timer fires normally.
      const originalResolve = resolve;
      resolve = () => {
        signal.removeEventListener("abort", onAbort);
        originalResolve();
      };
    }
  });
}

/**
 * Execute an async function with retry logic using exponential backoff.
 *
 * @param fn - The async function to execute.
 * @param options - Retry configuration options.
 * @returns The resolved value of `fn`.
 * @throws {RetryError} when all attempts are exhausted.
 * @throws The AbortSignal's reason if aborted during a wait.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    retryIf,
    onRetry,
    signal,
  } = options;

  if (maxAttempts < 1) {
    throw new RangeError("maxAttempts must be at least 1");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // If this was the last attempt, don't bother checking retryIf or sleeping.
      if (attempt === maxAttempts) {
        break;
      }

      // Check if we should retry this particular error.
      if (retryIf && !retryIf(error)) {
        break;
      }

      // Notify caller before sleeping.
      onRetry?.(error, attempt + 1);

      const delay = calculateDelay(
        attempt,
        baseDelay,
        maxDelay,
        backoffFactor,
        jitter,
      );

      await sleep(delay, signal);
    }
  }

  throw new RetryError(
    `All ${maxAttempts} retry attempts exhausted`,
    lastError,
    maxAttempts,
  );
}
