import { spawn } from "node:child_process";
import vm from "node:vm";

/**
 * Options for executing code or scripts in a child process.
 */
export interface ExecuteOptions {
  /** Timeout in milliseconds. Defaults to 5000. */
  timeout?: number;
  /** Environment variables to pass to the child process. */
  env?: Record<string, string>;
  /** Working directory for the child process. */
  cwd?: string;
  /** Maximum output size in bytes. Defaults to 1MB (1_048_576). */
  maxOutputSize?: number;
}

/**
 * Result of executing code or a script in a child process.
 */
export interface ExecutionResult {
  /** Captured standard output (may be truncated). */
  stdout: string;
  /** Captured standard error (may be truncated). */
  stderr: string;
  /** Process exit code. -1 if the process was killed. */
  exitCode: number;
  /** Whether the execution was terminated due to timeout. */
  timedOut: boolean;
  /** Wall-clock duration in milliseconds. */
  duration: number;
}

/**
 * Result of evaluating an expression with `vm.runInNewContext`.
 */
export interface EvalResult {
  /** The value produced by the expression. */
  value: unknown;
  /** The `typeof` the returned value. */
  type: string;
  /** Wall-clock duration in milliseconds. */
  duration: number;
}

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MAX_OUTPUT_SIZE = 1_048_576; // 1 MB

/**
 * Collect data from a readable stream, enforcing a maximum byte size.
 * Returns the collected string, truncated with a marker if it exceeds the limit.
 */
function collectStream(
  stream: NodeJS.ReadableStream,
  maxBytes: number,
): { promise: Promise<string>; collected: { value: string; overflowed: boolean } } {
  const state = { value: "", overflowed: false };
  let byteCount = 0;

  const promise = new Promise<string>((resolve) => {
    stream.on("data", (chunk: Buffer) => {
      if (state.overflowed) return;

      const text = chunk.toString();
      byteCount += chunk.length;

      if (byteCount > maxBytes) {
        // Keep only what fits within the limit
        const excess = byteCount - maxBytes;
        const keep = text.slice(0, text.length - excess);
        state.value += keep;
        state.overflowed = true;
      } else {
        state.value += text;
      }
    });

    stream.on("end", () => {
      if (state.overflowed) {
        state.value += "\n[output truncated]";
      }
      resolve(state.value);
    });

    stream.on("error", () => {
      resolve(state.value);
    });
  });

  return { promise, collected: state };
}

/**
 * Execute JavaScript code in a child process with timeout and output limits.
 *
 * The code is passed to `node -e` for execution. This provides process-level
 * isolation from the host.
 */
export async function execute(
  code: string,
  options: ExecuteOptions = {},
): Promise<ExecutionResult> {
  const {
    timeout = DEFAULT_TIMEOUT,
    env,
    cwd,
    maxOutputSize = DEFAULT_MAX_OUTPUT_SIZE,
  } = options;

  const start = performance.now();

  return new Promise<ExecutionResult>((resolve) => {
    const child = spawn("node", ["-e", code], {
      env: env ? { ...process.env, ...env } : undefined,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { promise: stdoutPromise } = collectStream(child.stdout!, maxOutputSize);
    const { promise: stderrPromise } = collectStream(child.stderr!, maxOutputSize);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout);

    child.on("close", async (exitCode) => {
      clearTimeout(timer);
      const duration = performance.now() - start;

      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
        timedOut,
        duration,
      });
    });

    child.on("error", async (err) => {
      clearTimeout(timer);
      const duration = performance.now() - start;

      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

      resolve({
        stdout,
        stderr: stderr || err.message,
        exitCode: -1,
        timedOut,
        duration,
      });
    });
  });
}

/**
 * Execute a script file in a child process with timeout and output limits.
 *
 * The file is run via `node <filePath> [args...]`. This provides process-level
 * isolation from the host.
 */
export async function executeScript(
  filePath: string,
  args: string[] = [],
  options: ExecuteOptions = {},
): Promise<ExecutionResult> {
  const {
    timeout = DEFAULT_TIMEOUT,
    env,
    cwd,
    maxOutputSize = DEFAULT_MAX_OUTPUT_SIZE,
  } = options;

  const start = performance.now();

  return new Promise<ExecutionResult>((resolve) => {
    const child = spawn("node", [filePath, ...args], {
      env: env ? { ...process.env, ...env } : undefined,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { promise: stdoutPromise } = collectStream(child.stdout!, maxOutputSize);
    const { promise: stderrPromise } = collectStream(child.stderr!, maxOutputSize);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout);

    child.on("close", async (exitCode) => {
      clearTimeout(timer);
      const duration = performance.now() - start;

      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
        timedOut,
        duration,
      });
    });

    child.on("error", async (err) => {
      clearTimeout(timer);
      const duration = performance.now() - start;

      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

      resolve({
        stdout,
        stderr: stderr || err.message,
        exitCode: -1,
        timedOut,
        duration,
      });
    });
  });
}

/**
 * Evaluate a JavaScript expression using `vm.runInNewContext`.
 *
 * **Security note:** Node.js `vm` is *not* a security boundary. It provides
 * basic sandboxing (no access to `require`, `process`, or `import` by default)
 * but a determined attacker can escape. Use `execute()` for stronger isolation.
 *
 * @param expression - The JavaScript expression to evaluate.
 * @param context    - Variables to expose inside the expression scope.
 */
export async function evaluateExpression(
  expression: string,
  context: Record<string, unknown> = {},
): Promise<EvalResult> {
  const timeout = 5000;
  const start = performance.now();

  // Build a clean context — explicitly exclude dangerous globals
  const safeContext: Record<string, unknown> = {
    ...context,
    // Provide common safe globals
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Promise,
    Symbol,
    BigInt,
    undefined,
    NaN,
    Infinity,
  };

  // Ensure dangerous globals are not accessible
  safeContext.process = undefined;
  safeContext.require = undefined;
  safeContext.import = undefined;
  safeContext.global = undefined;
  safeContext.globalThis = undefined;

  try {
    const value: unknown = vm.runInNewContext(expression, safeContext, {
      timeout,
      filename: "<expression>",
    });

    const duration = performance.now() - start;

    return {
      value,
      type: typeof value,
      duration,
    };
  } catch (err: unknown) {
    const duration = performance.now() - start;

    if (
      err instanceof Error &&
      err.message.includes("Script execution timed out")
    ) {
      throw new Error(
        `Expression evaluation timed out after ${timeout}ms`,
      );
    }

    throw err;
  }
}
