# @agent-tools/file-converter

Convert between common data file formats with zero external dependencies.

## Supported Formats

- **JSON** — full fidelity via native `JSON.parse`/`JSON.stringify`
- **YAML** — practical subset: key-value pairs, nested objects, arrays, scalars (strings, numbers, booleans, null), quoted strings. Does not cover anchors, aliases, multiline blocks, tags, or flow collections.
- **CSV** — comma-separated values with a header row, quoted fields with commas, and escaped quotes.

## Usage

```ts
import { convert, detectFormat, parseCSV, parseYAML, toYAML, toCSV } from "@agent-tools/file-converter";

// Convert between formats
const yaml = convert('{"name": "Alice"}', "json", "yaml");

// Auto-detect format
const fmt = detectFormat(input); // "json" | "yaml" | "csv" | null

// Use individual parsers
const rows = parseCSV("name,age\nAlice,30");
const obj = parseYAML("name: Alice\nage: 30");
const yamlStr = toYAML({ name: "Alice", age: 30 });
const csvStr = toCSV([{ name: "Alice", age: "30" }]);
```

## Limitations

This package targets the practical subset of each format that covers the vast majority of real-world configuration and data files. If you need full YAML spec compliance (anchors, aliases, multiline strings, custom tags), use a dedicated YAML library instead.
