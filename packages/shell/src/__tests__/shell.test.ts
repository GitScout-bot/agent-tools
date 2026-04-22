import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import { Shell, ShellError, ManagedProcess } from "../shell.js";

describe("Shell.run", () => {
  it("runs a simple command and returns structured result", async () => {
    const shell = new Shell();
    const result = await shell.run("echo hello");
    assert.equal(result.stdout.trim(), "hello");
    assert.equal(result.exitCode, 0);
    assert.ok(result.duration >= 0);
    assert.equal(result.stderr, "");
  });

  it("captures stderr", async () => {
    const shell = new Shell();
    const result = await shell.run("echo error >&2");
    assert.equal(result.stderr.trim(), "error");
    assert.equal(result.exitCode, 0);
  });

  it("returns non-zero exit code on failure", async () => {
    const shell = new Shell();
    const result = await shell.run("exit 42");
    assert.equal(result.exitCode, 42);
  });

  it("respects cwd option", async () => {
    const shell = new Shell({ cwd: "/tmp" });
    const result = await shell.run("pwd");
    assert.equal(result.stdout.trim(), "/tmp");
  });

  it("respects env option", async () => {
    const shell = new Shell({ env: { MY_TEST_VAR: "agent_tools" } });
    const result = await shell.run("echo $MY_TEST_VAR");
    assert.equal(result.stdout.trim(), "agent_tools");
  });

  it("times out long commands", async () => {
    const shell = new Shell({ timeout: 500 });
    const result = await shell.run("sleep 30");
    assert.notEqual(result.exitCode, 0);
  });

  it("supports per-command timeout override", async () => {
    const shell = new Shell({ timeout: 60_000 });
    const result = await shell.run("sleep 30", { timeout: 500 });
    assert.notEqual(result.exitCode, 0);
  });

  it("passes stdin to command", async () => {
    const shell = new Shell();
    const result = await shell.run("cat", { stdin: "piped input" });
    assert.equal(result.stdout, "piped input");
  });

  it("supports AbortSignal", async () => {
    const shell = new Shell();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(
      () => shell.run("sleep 10", { signal: controller.signal }),
      (err: Error) => err.name === "ShellError" || err.name === "AbortError",
    );
  });
});

describe("Shell.run parse", () => {
  it("parses JSON output", async () => {
    const shell = new Shell();
    const result = await shell.run('echo \'{"name":"test","value":42}\'', {
      parse: "json",
    });
    const parsed = result.parsed as Record<string, unknown>;
    assert.equal(parsed.name, "test");
    assert.equal(parsed.value, 42);
  });

  it("parses line output", async () => {
    const shell = new Shell();
    const result = await shell.run('printf "line1\\nline2\\nline3"', {
      parse: "lines",
    });
    const lines = result.parsed as string[];
    assert.deepEqual(lines, ["line1", "line2", "line3"]);
  });

  it("parses table output", async () => {
    const shell = new Shell();
    const result = await shell.run('printf "a b c\\n1 2 3"', {
      parse: "table",
    });
    const rows = result.parsed as string[][];
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ["a", "b", "c"]);
    assert.deepEqual(rows[1], ["1", "2", "3"]);
  });

  it("leaves parsed undefined on parse failure", async () => {
    const shell = new Shell();
    const result = await shell.run("echo not-json", { parse: "json" });
    assert.equal(result.parsed, undefined);
    assert.equal(result.stdout.trim(), "not-json");
  });
});

describe("Shell safety", () => {
  it("blocks dangerous commands by default", async () => {
    const shell = new Shell();
    await assert.rejects(
      () => shell.run("rm -rf /"),
      (err: ShellError) => err.code === "BLOCKED",
    );
  });

  it("blocks custom blocklist entries", async () => {
    const shell = new Shell({ blocklist: ["forbidden-cmd"] });
    await assert.rejects(
      () => shell.run("forbidden-cmd --flag"),
      (err: ShellError) => err.code === "BLOCKED",
    );
  });

  it("enforces allowlist when set", async () => {
    const shell = new Shell({ allowlist: ["echo", "cat"] });
    const result = await shell.run("echo allowed");
    assert.equal(result.stdout.trim(), "allowed");

    await assert.rejects(
      () => shell.run("ls /tmp"),
      (err: ShellError) => err.code === "NOT_ALLOWED",
    );
  });
});

describe("Shell.spawn", () => {
  it("spawns a long-running process", async () => {
    const shell = new Shell();
    const proc = shell.spawn('echo "started" && sleep 0.1 && echo "done"');
    assert.ok(proc instanceof ManagedProcess);
    assert.ok(proc.pid !== undefined);

    const code = await proc.waitForExit(5000);
    assert.equal(code, 0);
    assert.ok(proc.stdout.includes("started"));
    assert.ok(proc.stdout.includes("done"));
    assert.equal(proc.done, true);
  });

  it("waitFor matches a pattern in output", async () => {
    const shell = new Shell();
    const proc = shell.spawn(
      'echo "booting..." && sleep 0.1 && echo "Server ready on port 8080"',
    );

    const match = await proc.waitFor(/port (\d+)/);
    assert.equal(match[1], "8080");
    assert.equal(proc.lastMatch![1], "8080");
    proc.kill();
  });

  it("waitFor rejects on timeout", async () => {
    const shell = new Shell();
    const proc = shell.spawn("echo nothing-useful");

    await assert.rejects(
      () => proc.waitFor(/will-never-match/, 200),
      (err: ShellError) =>
        err.code === "WAIT_TIMEOUT" || err.code === "PROCESS_EXITED",
    );
  });

  it("kill stops the process", async () => {
    const shell = new Shell();
    const proc = shell.spawn("sleep 60");

    await new Promise((r) => setTimeout(r, 100));
    proc.kill("SIGKILL");
    const code = await proc.waitForExit(2000);
    assert.ok(proc.done);
    assert.notEqual(code, 0);
  });

  it("write sends data to stdin", async () => {
    const shell = new Shell();
    const proc = shell.spawn("cat");
    proc.write("hello from stdin\n");
    await new Promise((r) => setTimeout(r, 100));
    proc.kill("SIGKILL");
    const code = await proc.waitForExit(2000);
    assert.ok(proc.stdout.includes("hello from stdin"));
  });

  it("emits stdout events", async () => {
    const shell = new Shell();
    const proc = shell.spawn("echo event-test");
    const chunks: string[] = [];
    proc.on("stdout", (data: string) => chunks.push(data));
    await proc.waitForExit(2000);
    assert.ok(chunks.length > 0);
    assert.ok(chunks.join("").includes("event-test"));
  });
});

describe("ShellError", () => {
  it("has correct properties", () => {
    const err = new ShellError("test error", "TEST_CODE");
    assert.equal(err.message, "test error");
    assert.equal(err.code, "TEST_CODE");
    assert.equal(err.name, "ShellError");
  });

  it("preserves cause", () => {
    const cause = new Error("original");
    const err = new ShellError("wrapped", "WRAP", cause);
    assert.equal(err.cause, cause);
  });
});
