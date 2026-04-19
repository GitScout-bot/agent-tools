import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execute, executeScript, evaluateExpression } from "../sandbox.js";

describe("execute", () => {
  it("runs simple code and captures stdout", async () => {
    const result = await execute('console.log("hello world")');

    assert.equal(result.stdout.trim(), "hello world");
    assert.equal(result.exitCode, 0);
    assert.equal(result.timedOut, false);
    assert.ok(result.duration >= 0);
  });

  it("captures stderr", async () => {
    const result = await execute('console.error("oops")');

    assert.equal(result.stderr.trim(), "oops");
    assert.equal(result.exitCode, 0);
  });

  it("times out on infinite loops", async () => {
    const result = await execute("while (true) {}", { timeout: 500 });

    assert.equal(result.timedOut, true);
    assert.ok(result.duration >= 400);
  });

  it("returns correct exit code on error", async () => {
    const result = await execute("process.exit(42)");

    assert.equal(result.exitCode, 42);
    assert.equal(result.timedOut, false);
  });

  it("truncates output exceeding maxOutputSize", async () => {
    // Generate output larger than 100 bytes
    const code = 'console.log("A".repeat(500))';
    const result = await execute(code, { maxOutputSize: 100 });

    assert.ok(result.stdout.includes("[output truncated]"));
    // The non-truncated part should be at most 100 bytes + the truncation marker
    const withoutMarker = result.stdout.replace("\n[output truncated]", "");
    assert.ok(Buffer.byteLength(withoutMarker) <= 100);
  });
});

describe("executeScript", () => {
  it("runs a script file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sandbox-test-"));
    const scriptPath = join(dir, "test-script.js");

    writeFileSync(scriptPath, 'console.log("from script");');

    try {
      const result = await executeScript(scriptPath);

      assert.equal(result.stdout.trim(), "from script");
      assert.equal(result.exitCode, 0);
      assert.equal(result.timedOut, false);
    } finally {
      unlinkSync(scriptPath);
    }
  });

  it("passes arguments to the script", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sandbox-test-"));
    const scriptPath = join(dir, "args-script.js");

    writeFileSync(scriptPath, "console.log(process.argv.slice(2).join(' '));");

    try {
      const result = await executeScript(scriptPath, ["hello", "world"]);

      assert.equal(result.stdout.trim(), "hello world");
    } finally {
      unlinkSync(scriptPath);
    }
  });
});

describe("evaluateExpression", () => {
  it("evaluates simple expressions", async () => {
    const result = await evaluateExpression("2 + 3");

    assert.equal(result.value, 5);
    assert.equal(result.type, "number");
    assert.ok(result.duration >= 0);
  });

  it("uses provided context", async () => {
    const result = await evaluateExpression("x * y + z", {
      x: 10,
      y: 5,
      z: 3,
    });

    assert.equal(result.value, 53);
  });

  it("returns correct type for strings", async () => {
    const result = await evaluateExpression('"hello" + " " + "world"');

    assert.equal(result.value, "hello world");
    assert.equal(result.type, "string");
  });

  it("times out on expensive computation", async () => {
    await assert.rejects(
      () => evaluateExpression("while(true) {}"),
      (err: Error) => {
        assert.ok(err.message.includes("timed out"));
        return true;
      },
    );
  });

  it("blocks access to process", async () => {
    const result = await evaluateExpression("typeof process");

    assert.equal(result.value, "undefined");
  });

  it("blocks access to require", async () => {
    const result = await evaluateExpression("typeof require");

    assert.equal(result.value, "undefined");
  });

  it("allows safe built-in objects", async () => {
    const result = await evaluateExpression("Math.max(1, 2, 3)");

    assert.equal(result.value, 3);
  });
});
