import { spawn, execFile, ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export interface ShellOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  shell?: string | boolean;
  blocklist?: string[];
  allowlist?: string[];
  maxBuffer?: number;
}

export interface RunOptions {
  timeout?: number;
  env?: Record<string, string>;
  parse?: "json" | "lines" | "table";
  stdin?: string;
  signal?: AbortSignal;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  parsed?: unknown;
}

export interface SpawnOptions {
  timeout?: number;
  env?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024; // 10MB

const DEFAULT_BLOCKLIST = [
  "rm -rf /",
  "rm -rf /*",
  "mkfs",
  "dd if=/dev/zero",
  ":(){:|:&};:",
  "chmod -R 777 /",
];

export class Shell {
  private cwd: string;
  private timeout: number;
  private env: Record<string, string>;
  private shellPath: string | boolean;
  private blocklist: string[];
  private allowlist: string[] | null;
  private maxBuffer: number;

  constructor(options: ShellOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.env = { ...process.env, ...options.env } as Record<string, string>;
    this.shellPath = options.shell ?? true;
    this.blocklist = [...DEFAULT_BLOCKLIST, ...(options.blocklist ?? [])];
    this.allowlist = options.allowlist ?? null;
    this.maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
  }

  private checkCommand(command: string): void {
    const normalized = command.trim().toLowerCase();

    for (const blocked of this.blocklist) {
      if (normalized.includes(blocked.toLowerCase())) {
        throw new ShellError(
          `Command blocked by safety filter: "${command}"`,
          "BLOCKED",
        );
      }
    }

    if (this.allowlist) {
      const bin = normalized.split(/\s+/)[0]!;
      if (!this.allowlist.some((a) => bin === a.toLowerCase())) {
        throw new ShellError(
          `Command not in allowlist: "${bin}"`,
          "NOT_ALLOWED",
        );
      }
    }
  }

  async run(command: string, options: RunOptions = {}): Promise<RunResult> {
    this.checkCommand(command);

    const timeout = options.timeout ?? this.timeout;
    const env = { ...this.env, ...options.env };
    const start = performance.now();

    return new Promise<RunResult>((resolve, reject) => {
      const proc = spawn(command, [], {
        cwd: this.cwd,
        env,
        shell: this.shellPath,
        signal: options.signal,
        detached: true,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const killProc = (sig: NodeJS.Signals) => {
        if (proc.pid) {
          try { process.kill(-proc.pid, sig); } catch { proc.kill(sig); }
        } else {
          proc.kill(sig);
        }
      };

      const timer = timeout > 0
        ? setTimeout(() => {
            killProc("SIGTERM");
            setTimeout(() => killProc("SIGKILL"), 1000);
          }, timeout)
        : null;

      proc.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > this.maxBuffer && !settled) {
          settled = true;
          killProc("SIGTERM");
          if (timer) clearTimeout(timer);
          reject(
            new ShellError("stdout exceeded maxBuffer", "MAX_BUFFER"),
          );
        }
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      if (options.stdin !== undefined) {
        proc.stdin?.write(options.stdin);
        proc.stdin?.end();
      }

      proc.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        reject(
          new ShellError(
            `Failed to execute: ${err.message}`,
            "EXEC_ERROR",
            err,
          ),
        );
      });

      proc.on("close", (code: number | null) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        const duration = Math.round(performance.now() - start);
        const exitCode = code ?? 1;
        const result: RunResult = { stdout, stderr, exitCode, duration };

        if (options.parse) {
          try {
            result.parsed = parseOutput(stdout, options.parse);
          } catch {
            // parsed stays undefined if parsing fails
          }
        }

        resolve(result);
      });
    });
  }

  spawn(command: string, options: SpawnOptions = {}): ManagedProcess {
    this.checkCommand(command);

    const env = { ...this.env, ...options.env };
    const timeout = options.timeout ?? 0; // 0 = no timeout for long-running

    const proc = spawn(command, [], {
      cwd: this.cwd,
      env,
      shell: this.shellPath,
      detached: true,
    });

    return new ManagedProcess(proc, timeout);
  }
}

export class ManagedProcess extends EventEmitter {
  private proc: ChildProcess;
  private _stdout: string = "";
  private _stderr: string = "";
  private _exitCode: number | null = null;
  private _done: boolean = false;
  private _lastMatch: RegExpMatchArray | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(proc: ChildProcess, timeout: number) {
    super();
    this.proc = proc;

    proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this._stdout += text;
      this.emit("stdout", text);
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this._stderr += text;
      this.emit("stderr", text);
    });

    proc.on("close", (code) => {
      this._exitCode = code ?? 1;
      this._done = true;
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.emit("close", this._exitCode);
    });

    proc.on("error", (err) => {
      this._done = true;
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.emit("error", err);
    });

    if (timeout > 0) {
      this.timeoutId = setTimeout(() => {
        this.kill();
      }, timeout);
    }
  }

  get stdout(): string {
    return this._stdout;
  }

  get stderr(): string {
    return this._stderr;
  }

  get exitCode(): number | null {
    return this._exitCode;
  }

  get done(): boolean {
    return this._done;
  }

  get lastMatch(): RegExpMatchArray | null {
    return this._lastMatch;
  }

  get pid(): number | undefined {
    return this.proc.pid;
  }

  async waitFor(
    pattern: RegExp,
    timeout: number = 30_000,
  ): Promise<RegExpMatchArray> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new ShellError(
            `Timed out waiting for pattern: ${pattern}`,
            "WAIT_TIMEOUT",
          ),
        );
      }, timeout);

      const check = (text: string) => {
        const match = text.match(pattern);
        if (match) {
          clearTimeout(timer);
          this._lastMatch = match;
          this.removeListener("stdout", onData);
          resolve(match);
        }
      };

      // Check already-buffered output
      const existing = this._stdout.match(pattern);
      if (existing) {
        clearTimeout(timer);
        this._lastMatch = existing;
        resolve(existing);
        return;
      }

      const onData = (_chunk: string) => {
        check(this._stdout);
      };

      this.on("stdout", onData);

      this.on("close", () => {
        clearTimeout(timer);
        this.removeListener("stdout", onData);
        reject(
          new ShellError(
            `Process exited before pattern matched: ${pattern}`,
            "PROCESS_EXITED",
          ),
        );
      });
    });
  }

  async waitForExit(timeout: number = 30_000): Promise<number> {
    if (this._done) return this._exitCode!;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new ShellError("Timed out waiting for process exit", "WAIT_TIMEOUT"),
        );
      }, timeout);

      this.on("close", (code: number) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  }

  write(data: string): void {
    this.proc.stdin?.write(data);
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    if (!this._done && this.proc.pid) {
      try {
        process.kill(-this.proc.pid, signal);
      } catch {
        this.proc.kill(signal);
      }
    }
  }
}

export class ShellError extends Error {
  code: string;
  cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = "ShellError";
    this.code = code;
    this.cause = cause;
  }
}

function parseOutput(
  stdout: string,
  format: "json" | "lines" | "table",
): unknown {
  switch (format) {
    case "json":
      return JSON.parse(stdout);

    case "lines":
      return stdout
        .split("\n")
        .filter((line) => line.length > 0);

    case "table": {
      const lines = stdout.trim().split("\n").filter((l) => l.length > 0);
      if (lines.length === 0) return [];

      return lines.map((line) => {
        const parts = line.split(/\s+/);
        return parts;
      });
    }
  }
}
