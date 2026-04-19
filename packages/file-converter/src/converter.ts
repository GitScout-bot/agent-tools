/**
 * File format converter — JSON, YAML, CSV.
 * Zero external dependencies; parsers are implemented inline.
 */

export type Format = "json" | "yaml" | "csv";

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string (with header row) into an array of objects.
 * Handles quoted fields containing commas and escaped quotes ("").
 */
export function parseCSV(input: string): Record<string, string>[] {
  const rows = splitCSVRows(input);
  if (rows.length === 0) return [];

  const headers = parseCSVRow(rows[0]);
  const result: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = parseCSVRow(rows[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] ?? "";
    }
    result.push(record);
  }

  return result;
}

/**
 * Convert an array of objects to a CSV string.
 * If `columns` is omitted the keys of the first object are used.
 */
export function toCSV(
  data: Record<string, string>[],
  columns?: string[],
): string {
  if (data.length === 0) return "";

  const cols = columns ?? Object.keys(data[0]);
  const lines: string[] = [cols.map(escapeCSVField).join(",")];

  for (const row of data) {
    lines.push(cols.map((c) => escapeCSVField(row[c] ?? "")).join(","));
  }

  return lines.join("\n");
}

function splitCSVRows(input: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '""';
        i++; // skip escaped quote — keep both for parseCSVRow
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      if (current.length > 0) rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.length > 0) rows.push(current);
  return rows;
}

function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];

    if (ch === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

// ---------------------------------------------------------------------------
// YAML (practical subset)
// ---------------------------------------------------------------------------

/**
 * Parse a simple YAML string.
 *
 * Supported features:
 * - key: value pairs
 * - Nested objects via indentation
 * - Arrays via `- item` syntax
 * - Quoted strings (single and double)
 * - Numbers, booleans (true/false), null
 *
 * NOT supported: anchors, aliases, multiline strings, tags, flow style, etc.
 */
export function parseYAML(input: string): unknown {
  const lines = input.split(/\r?\n/);
  const filtered = lines.filter(
    (l) => l.trim() !== "" && !l.trim().startsWith("#"),
  );
  if (filtered.length === 0) return null;

  return parseYAMLBlock(filtered, 0, 0).value;
}

interface ParseResult {
  value: unknown;
  consumed: number;
}

function lineIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseYAMLBlock(
  lines: string[],
  start: number,
  baseIndent: number,
): ParseResult {
  if (start >= lines.length) return { value: null, consumed: 0 };

  const firstLine = lines[start];
  const trimmed = firstLine.trim();

  // Check if this block is an array (first line starts with "- ")
  if (trimmed.startsWith("- ")) {
    return parseYAMLArray(lines, start, baseIndent);
  }

  // Otherwise treat as a mapping
  return parseYAMLMapping(lines, start, baseIndent);
}

function parseYAMLArray(
  lines: string[],
  start: number,
  baseIndent: number,
): ParseResult {
  const result: unknown[] = [];
  let i = start;

  while (i < lines.length) {
    const indent = lineIndent(lines[i]);
    if (indent < baseIndent) break;
    if (indent !== baseIndent) break;

    const trimmed = lines[i].trim();
    if (!trimmed.startsWith("- ")) break;

    const afterDash = trimmed.slice(2);

    // Check if the item itself contains a key: value (inline mapping start)
    if (afterDash.includes(": ") || afterDash.endsWith(":")) {
      // Collect child lines for a nested block starting from this "- key: val"
      // Rewrite the current line as if it were a normal mapping entry,
      // then gather any further indented lines beneath it.
      const childLines: string[] = [];
      const childIndent = baseIndent + 2;
      // Create a synthetic line from the part after "- "
      childLines.push(" ".repeat(childIndent) + afterDash);
      let j = i + 1;
      while (j < lines.length && lineIndent(lines[j]) > baseIndent) {
        childLines.push(lines[j]);
        j++;
      }
      const sub = parseYAMLBlock(childLines, 0, childIndent);
      result.push(sub.value);
      i = i + 1 + (j - (i + 1));
    } else {
      // Simple scalar array item
      result.push(parseYAMLScalar(afterDash));
      i++;
    }
  }

  return { value: result, consumed: i - start };
}

function parseYAMLMapping(
  lines: string[],
  start: number,
  baseIndent: number,
): ParseResult {
  const result: Record<string, unknown> = {};
  let i = start;

  while (i < lines.length) {
    const indent = lineIndent(lines[i]);
    if (indent < baseIndent) break;
    if (indent !== baseIndent) {
      i++;
      continue;
    }

    const trimmed = lines[i].trim();
    const colonMatch = trimmed.match(/^([^:]+?):\s*(.*)/);
    if (!colonMatch) {
      i++;
      continue;
    }

    const key = parseYAMLScalar(colonMatch[1].trim()) as string;
    const inlineValue = colonMatch[2];

    if (inlineValue === "" || inlineValue === undefined) {
      // Value is a nested block on subsequent lines
      const nextIdx = i + 1;
      if (nextIdx < lines.length) {
        const nextIndent = lineIndent(lines[nextIdx]);
        if (nextIndent > baseIndent) {
          const sub = parseYAMLBlock(lines, nextIdx, nextIndent);
          result[key] = sub.value;
          i = nextIdx + sub.consumed;
          continue;
        }
      }
      result[key] = null;
      i++;
    } else {
      result[key] = parseYAMLScalar(inlineValue);
      i++;
    }
  }

  return { value: result, consumed: i - start };
}

function parseYAMLScalar(raw: string): unknown {
  const value = raw.trim();
  if (value === "") return null;

  // Quoted strings
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  // null
  if (value === "null" || value === "~") return null;

  // booleans
  if (value === "true") return true;
  if (value === "false") return false;

  // numbers
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  // Inline array [a, b, c]
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => parseYAMLScalar(s.trim()));
  }

  return value;
}

/**
 * Serialize a value to YAML.
 */
export function toYAML(data: unknown, indent: number = 0): string {
  const prefix = " ".repeat(indent);

  if (data === null || data === undefined) {
    return "null\n";
  }

  if (typeof data === "string") {
    if (
      data.includes(":") ||
      data.includes("#") ||
      data.includes('"') ||
      data.includes("'") ||
      data.includes("\n") ||
      data === "true" ||
      data === "false" ||
      data === "null" ||
      /^-?\d+(\.\d+)?$/.test(data)
    ) {
      return `"${data.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"\n`;
    }
    return data + "\n";
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return String(data) + "\n";
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]\n";
    let out = "\n";
    for (const item of data) {
      if (isPlainObject(item)) {
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length > 0) {
          const [firstKey, firstVal] = entries[0];
          const firstValStr = isPlainObject(firstVal) || Array.isArray(firstVal)
            ? "\n" + toYAMLObject(firstVal as Record<string, unknown>, indent + 4)
            : " " + toYAML(firstVal, 0);
          out += prefix + "- " + firstKey + ":" + firstValStr;
          for (let e = 1; e < entries.length; e++) {
            const [k, v] = entries[e];
            const valStr = isPlainObject(v) || Array.isArray(v)
              ? "\n" + toYAMLObject(v as Record<string, unknown>, indent + 4)
              : " " + toYAML(v, 0);
            out += prefix + "  " + k + ":" + valStr;
          }
        } else {
          out += prefix + "- {}\n";
        }
      } else {
        out += prefix + "- " + toYAML(item, indent + 2).trimStart();
      }
    }
    return out;
  }

  if (isPlainObject(data)) {
    if (Object.keys(data as Record<string, unknown>).length === 0) return "{}\n";
    return "\n" + toYAMLObject(data as Record<string, unknown>, indent);
  }

  return String(data) + "\n";
}

function toYAMLObject(
  obj: Record<string, unknown>,
  indent: number,
): string {
  const prefix = " ".repeat(indent);
  let out = "";
  for (const [key, val] of Object.entries(obj)) {
    if (isPlainObject(val) || Array.isArray(val)) {
      out += prefix + key + ":" + toYAML(val, indent + 2);
    } else {
      out += prefix + key + ": " + toYAML(val, 0);
    }
  }
  return out;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * Attempt to auto-detect the format of the input string.
 * Returns null if detection is ambiguous or fails.
 */
export function detectFormat(input: string): Format | null {
  const trimmed = input.trim();

  // JSON: starts with { or [
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // not valid JSON
    }
  }

  // CSV: first line looks like comma-separated headers
  const firstLine = trimmed.split(/\r?\n/)[0];
  if (firstLine.includes(",") && !firstLine.includes(":")) {
    return "csv";
  }

  // YAML: contains "key: value" patterns or starts with "- "
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*:/m.test(trimmed) || trimmed.startsWith("- ")) {
    return "yaml";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main conversion function
// ---------------------------------------------------------------------------

/**
 * Convert a string from one format to another.
 */
export function convert(input: string, from: Format, to: Format): string {
  if (from === to) return input;

  // Parse input to intermediate representation
  let data: unknown;

  switch (from) {
    case "json":
      data = JSON.parse(input);
      break;
    case "yaml":
      data = parseYAML(input);
      break;
    case "csv":
      data = parseCSV(input);
      break;
  }

  // Serialize to target format
  switch (to) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return toYAML(data).trim() + "\n";
    case "csv": {
      if (!Array.isArray(data)) {
        throw new Error(
          "CSV output requires array data. The input does not represent an array of records.",
        );
      }
      return toCSV(data as Record<string, string>[]);
    }
  }
}
