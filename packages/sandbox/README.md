# @agent-tools/sandbox

Safe code execution with timeouts and resource limits. Provides three levels of isolation for running untrusted JavaScript.

## Installation

```bash
npm install @agent-tools/sandbox
```

## Usage

### Execute code in a child process

```typescript
import { execute } from "@agent-tools/sandbox";

const result = await execute('console.log("hello")', {
  timeout: 3000,
  maxOutputSize: 1024,
});

console.log(result.stdout);    // "hello\n"
console.log(result.exitCode);  // 0
console.log(result.timedOut);  // false
console.log(result.duration);  // ~50 (ms)
```

### Execute a script file

```typescript
import { executeScript } from "@agent-tools/sandbox";

const result = await executeScript("./my-script.js", ["--flag", "value"], {
  timeout: 10000,
  cwd: "/tmp",
  env: { NODE_ENV: "production" },
});
```

### Evaluate an expression

```typescript
import { evaluateExpression } from "@agent-tools/sandbox";

const result = await evaluateExpression("x * 2 + y", { x: 10, y: 5 });

console.log(result.value); // 25
console.log(result.type);  // "number"
```

## API

### `execute(code, options?)`

Runs JavaScript code in a child process via `node -e`. Returns an `ExecutionResult`.

### `executeScript(filePath, args?, options?)`

Runs a script file in a child process via `node <file> [args]`. Returns an `ExecutionResult`.

### `evaluateExpression(expression, context?)`

Evaluates a JavaScript expression using `vm.runInNewContext`. Returns an `EvalResult`.

### Options

| Option         | Default     | Description                              |
| -------------- | ----------- | ---------------------------------------- |
| `timeout`      | `5000`      | Maximum execution time in milliseconds   |
| `env`          | `undefined` | Environment variables for child process  |
| `cwd`          | `undefined` | Working directory for child process      |
| `maxOutputSize`| `1048576`   | Maximum stdout/stderr size in bytes (1MB)|

## Security Notes

- **`execute` / `executeScript`**: Provide process-level isolation. The executed code runs in a separate Node.js process, so it cannot access the host process memory or state. This is the recommended approach for running untrusted code.

- **`evaluateExpression`**: Uses `vm.runInNewContext`, which is **not a security boundary**. It provides basic sandboxing by removing access to `process`, `require`, and `import`, but a determined attacker can escape the VM context. Use this only for simple expression evaluation where the input is semi-trusted, or use `execute()` for stronger isolation.

- All execution methods enforce timeouts to prevent runaway processes.
- Output is capped at `maxOutputSize` to prevent memory exhaustion.
