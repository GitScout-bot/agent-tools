import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { retry, RetryError } from "../retry.js";

describe("retry", () => {
  it("succeeds on first try", async () => {
    const result = await retry(async () => 42, {
      maxAttempts: 3,
      baseDelay: 1,
    });
    assert.equal(result, 42);
  });

  it("retries on failure and eventually succeeds", async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new Error(`fail #${calls}`);
        }
        return "ok";
      },
      { maxAttempts: 5, baseDelay: 1, jitter: false },
    );
    assert.equal(result, "ok");
    assert.equal(calls, 3);
  });

  it("throws RetryError after max attempts", async () => {
    const err = await assert.rejects(
      () =>
        retry(
          async () => {
            throw new Error("always fails");
          },
          { maxAttempts: 3, baseDelay: 1, jitter: false },
        ),
      (thrown: unknown) => {
        assert.ok(thrown instanceof RetryError);
        assert.equal(thrown.attempts, 3);
        assert.ok(thrown.cause instanceof Error);
        assert.equal((thrown.cause as Error).message, "always fails");
        assert.match(thrown.message, /3 retry attempts exhausted/);
        return true;
      },
    );
  });

  it("respects retryIf predicate — stops early on non-retryable error", async () => {
    let calls = 0;

    await assert.rejects(
      () =>
        retry(
          async () => {
            calls++;
            throw new Error("fatal");
          },
          {
            maxAttempts: 5,
            baseDelay: 1,
            jitter: false,
            retryIf: (err) =>
              err instanceof Error && err.message !== "fatal",
          },
        ),
      (thrown: unknown) => {
        assert.ok(thrown instanceof RetryError);
        // Should have stopped after the first attempt since retryIf returned false.
        assert.equal(calls, 1);
        return true;
      },
    );
  });

  it("retryIf allows retries for matching errors", async () => {
    let calls = 0;

    const result = await retry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new Error("transient");
        }
        return "recovered";
      },
      {
        maxAttempts: 5,
        baseDelay: 1,
        jitter: false,
        retryIf: (err) =>
          err instanceof Error && err.message === "transient",
      },
    );

    assert.equal(result, "recovered");
    assert.equal(calls, 3);
  });

  it("aborts via AbortSignal before any retry wait", async () => {
    const controller = new AbortController();
    let calls = 0;

    const promise = retry(
      async () => {
        calls++;
        if (calls === 1) {
          // Abort right after the first failure, before the retry sleep.
          controller.abort(new Error("user cancelled"));
        }
        throw new Error("fail");
      },
      { maxAttempts: 5, baseDelay: 60_000, signal: controller.signal },
    );

    await assert.rejects(promise, (thrown: unknown) => {
      assert.ok(thrown instanceof Error);
      assert.equal((thrown as Error).message, "user cancelled");
      return true;
    });

    assert.equal(calls, 1);
  });

  it("aborts via AbortSignal during sleep", async () => {
    const controller = new AbortController();
    let calls = 0;

    // Abort after a short delay so the retry sleep is interrupted.
    setTimeout(() => controller.abort(new Error("cancelled during sleep")), 50);

    const promise = retry(
      async () => {
        calls++;
        throw new Error("fail");
      },
      { maxAttempts: 5, baseDelay: 60_000, jitter: false, signal: controller.signal },
    );

    await assert.rejects(promise, (thrown: unknown) => {
      assert.ok(thrown instanceof Error);
      assert.equal((thrown as Error).message, "cancelled during sleep");
      return true;
    });

    assert.equal(calls, 1);
  });

  it("calls onRetry callback with error and next attempt number", async () => {
    const retryLog: Array<{ error: unknown; attempt: number }> = [];
    let calls = 0;

    await retry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new Error(`err-${calls}`);
        }
        return "done";
      },
      {
        maxAttempts: 5,
        baseDelay: 1,
        jitter: false,
        onRetry: (error, attempt) => {
          retryLog.push({ error, attempt });
        },
      },
    );

    assert.equal(retryLog.length, 2);
    assert.equal(retryLog[0].attempt, 2);
    assert.equal((retryLog[0].error as Error).message, "err-1");
    assert.equal(retryLog[1].attempt, 3);
    assert.equal((retryLog[1].error as Error).message, "err-2");
  });

  it("exponential backoff increases delay between retries", async () => {
    const timestamps: number[] = [];
    let calls = 0;

    await assert.rejects(() =>
      retry(
        async () => {
          timestamps.push(Date.now());
          calls++;
          throw new Error("fail");
        },
        {
          maxAttempts: 4,
          baseDelay: 50,
          backoffFactor: 2,
          jitter: false,
        },
      ),
    );

    assert.equal(calls, 4);

    // With jitter=false and baseDelay=50, backoffFactor=2:
    // delay after attempt 1 = 50ms, after attempt 2 = 100ms, after attempt 3 = 200ms
    const gap1 = timestamps[1] - timestamps[0]; // ~50ms
    const gap2 = timestamps[2] - timestamps[1]; // ~100ms
    const gap3 = timestamps[3] - timestamps[2]; // ~200ms

    // Allow generous tolerance for CI timing, but verify ordering.
    assert.ok(
      gap2 > gap1 * 1.3,
      `Expected gap2 (${gap2}ms) > gap1 (${gap1}ms) * 1.3`,
    );
    assert.ok(
      gap3 > gap2 * 1.3,
      `Expected gap3 (${gap3}ms) > gap2 (${gap2}ms) * 1.3`,
    );
  });

  it("throws RangeError when maxAttempts < 1", async () => {
    await assert.rejects(
      () => retry(async () => "ok", { maxAttempts: 0 }),
      (thrown: unknown) => {
        assert.ok(thrown instanceof RangeError);
        return true;
      },
    );
  });

  it("respects maxDelay cap", async () => {
    const timestamps: number[] = [];
    let calls = 0;

    await assert.rejects(() =>
      retry(
        async () => {
          timestamps.push(Date.now());
          calls++;
          throw new Error("fail");
        },
        {
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 100,
          backoffFactor: 10,
          jitter: false,
        },
      ),
    );

    // Both gaps should be ~100ms since maxDelay caps the exponential growth.
    const gap1 = timestamps[1] - timestamps[0];
    const gap2 = timestamps[2] - timestamps[1];

    // The gaps should be approximately equal (both capped at 100ms).
    const ratio = Math.max(gap1, gap2) / Math.min(gap1, gap2);
    assert.ok(
      ratio < 2,
      `Expected gaps to be roughly equal, got ${gap1}ms and ${gap2}ms`,
    );
  });
});
