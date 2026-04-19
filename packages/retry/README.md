# @agent-tools/retry

Retry with exponential backoff, jitter, and abort support.

## Installation

```bash
npm install @agent-tools/retry
```

## Usage

### Basic retry

```ts
import { retry } from "@agent-tools/retry";

const data = await retry(() => fetch("/api/data").then((r) => r.json()));
```

### Custom options

```ts
const result = await retry(() => callExternalService(), {
  maxAttempts: 5,
  baseDelay: 500,
  maxDelay: 10_000,
  backoffFactor: 2,
  jitter: true,
  retryIf: (err) => err instanceof Error && err.message.includes("timeout"),
  onRetry: (err, attempt) => console.log(`Retry #${attempt}:`, err),
});
```

### Abort support

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  await retry(() => slowOperation(), {
    maxAttempts: 10,
    signal: controller.signal,
  });
} catch (err) {
  // Abort reason or RetryError
}
```

### Error handling

```ts
import { retry, RetryError } from "@agent-tools/retry";

try {
  await retry(() => unstableCall(), { maxAttempts: 3 });
} catch (err) {
  if (err instanceof RetryError) {
    console.log(`Failed after ${err.attempts} attempts`);
    console.log("Last error:", err.cause);
  }
}
```

## API

### `retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>`

Executes `fn` with retry logic. Returns the resolved value on success, or throws a `RetryError` after all attempts are exhausted.

### `RetryOptions`

| Option         | Type                          | Default | Description                                  |
| -------------- | ----------------------------- | ------- | -------------------------------------------- |
| `maxAttempts`  | `number`                      | `3`     | Total attempts including the first            |
| `baseDelay`    | `number`                      | `1000`  | Base delay in ms before first retry           |
| `maxDelay`     | `number`                      | `30000` | Maximum delay cap in ms                       |
| `backoffFactor`| `number`                      | `2`     | Multiplier applied after each attempt         |
| `jitter`       | `boolean`                     | `true`  | Randomize delay (0-100% of calculated delay)  |
| `retryIf`      | `(error: unknown) => boolean` | —       | Return `false` to stop retrying immediately   |
| `onRetry`      | `(error: unknown, attempt: number) => void` | — | Called before each retry sleep |
| `signal`       | `AbortSignal`                 | —       | Cancel the retry loop                         |

### `RetryError`

- `message` — Description of the failure
- `cause` — The error from the last attempt
- `attempts` — Total number of attempts made
