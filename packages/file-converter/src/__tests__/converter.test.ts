import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  convert,
  parseCSV,
  toCSV,
  parseYAML,
  toYAML,
  detectFormat,
} from "../converter.js";

describe("convert", () => {
  it("JSON to YAML", () => {
    const json = JSON.stringify({ name: "Alice", age: 30 }, null, 2);
    const yaml = convert(json, "json", "yaml");
    assert.ok(yaml.includes("name: Alice"));
    assert.ok(yaml.includes("age: 30"));
  });

  it("YAML to JSON", () => {
    const yaml = "name: Alice\nage: 30\n";
    const json = convert(yaml, "yaml", "json");
    const parsed = JSON.parse(json);
    assert.equal(parsed.name, "Alice");
    assert.equal(parsed.age, 30);
  });

  it("JSON to CSV", () => {
    const data = [
      { name: "Alice", city: "NYC" },
      { name: "Bob", city: "LA" },
    ];
    const json = JSON.stringify(data);
    const csv = convert(json, "json", "csv");
    assert.ok(csv.includes("name,city"));
    assert.ok(csv.includes("Alice,NYC"));
    assert.ok(csv.includes("Bob,LA"));
  });

  it("CSV to JSON", () => {
    const csv = "name,city\nAlice,NYC\nBob,LA";
    const json = convert(csv, "csv", "json");
    const parsed = JSON.parse(json);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].name, "Alice");
    assert.equal(parsed[1].city, "LA");
  });

  it("round-trip JSON -> YAML -> JSON preserves data", () => {
    const original = { title: "Test", count: 42, active: true };
    const json1 = JSON.stringify(original, null, 2);
    const yaml = convert(json1, "json", "yaml");
    const json2 = convert(yaml, "yaml", "json");
    const result = JSON.parse(json2);
    assert.deepEqual(result, original);
  });
});

describe("parseCSV", () => {
  it("parses basic CSV", () => {
    const csv = "a,b,c\n1,2,3\n4,5,6";
    const rows = parseCSV(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].a, "1");
    assert.equal(rows[1].c, "6");
  });

  it("handles quoted fields with commas", () => {
    const csv = 'name,bio\nAlice,"likes cats, dogs"\nBob,"says ""hi"""';
    const rows = parseCSV(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].bio, "likes cats, dogs");
    assert.equal(rows[1].bio, 'says "hi"');
  });
});

describe("toCSV", () => {
  it("produces valid CSV with headers", () => {
    const data = [{ x: "1", y: "2" }];
    const csv = toCSV(data);
    assert.equal(csv, "x,y\n1,2");
  });

  it("respects custom column order", () => {
    const data = [{ a: "1", b: "2", c: "3" }];
    const csv = toCSV(data, ["c", "a"]);
    assert.ok(csv.startsWith("c,a"));
  });
});

describe("parseYAML", () => {
  it("parses simple key-value pairs", () => {
    const result = parseYAML("name: Alice\nage: 30\n") as Record<
      string,
      unknown
    >;
    assert.equal(result.name, "Alice");
    assert.equal(result.age, 30);
  });

  it("parses booleans and null", () => {
    const result = parseYAML(
      "active: true\ndeleted: false\nvalue: null\n",
    ) as Record<string, unknown>;
    assert.equal(result.active, true);
    assert.equal(result.deleted, false);
    assert.equal(result.value, null);
  });

  it("parses nested objects", () => {
    const yaml = "person:\n  name: Bob\n  age: 25\n";
    const result = parseYAML(yaml) as Record<string, Record<string, unknown>>;
    assert.equal(result.person.name, "Bob");
    assert.equal(result.person.age, 25);
  });

  it("parses arrays", () => {
    const yaml = "items:\n  - apple\n  - banana\n  - cherry\n";
    const result = parseYAML(yaml) as Record<string, string[]>;
    assert.deepEqual(result.items, ["apple", "banana", "cherry"]);
  });

  it("parses quoted strings", () => {
    const yaml = 'msg: "hello world"\nother: \'single\'\n';
    const result = parseYAML(yaml) as Record<string, string>;
    assert.equal(result.msg, "hello world");
    assert.equal(result.other, "single");
  });

  it("parses literal block scalar (|)", () => {
    const yaml = "description: |\n  This is a\n  multiline string\n";
    const result = parseYAML(yaml) as Record<string, string>;
    assert.equal(result.description, "This is a\nmultiline string\n");
  });

  it("parses folded block scalar (>)", () => {
    const yaml = "description: >\n  This is a\n  folded string\n";
    const result = parseYAML(yaml) as Record<string, string>;
    assert.equal(result.description, "This is a folded string\n");
  });

  it("parses block scalar with strip chomping (|-)", () => {
    const yaml = "description: |-\n  No trailing newline\n";
    const result = parseYAML(yaml) as Record<string, string>;
    assert.equal(result.description, "No trailing newline");
  });

  it("parses block scalar with keep chomping (|+)", () => {
    const yaml = "description: |+\n  Keep trailing\n";
    const result = parseYAML(yaml) as Record<string, string>;
    assert.equal(result.description, "Keep trailing\n");
  });

  it("parses folded block scalar with strip chomping (>-)", () => {
    const yaml = "description: >-\n  Folded and\n  stripped\n";
    const result = parseYAML(yaml) as Record<string, string>;
    assert.equal(result.description, "Folded and stripped");
  });

  it("parses block scalar alongside other keys", () => {
    const yaml = "title: Hello\nbody: |\n  Line one\n  Line two\ncount: 42\n";
    const result = parseYAML(yaml) as Record<string, unknown>;
    assert.equal(result.title, "Hello");
    assert.equal(result.body, "Line one\nLine two\n");
    assert.equal(result.count, 42);
  });

  it("parses folded block with paragraph break", () => {
    const yaml = "text: >\n  First paragraph\n  continues here\n\n  Second paragraph\n";
    const result = parseYAML(yaml) as Record<string, string>;
    assert.equal(result.text, "First paragraph continues here\nSecond paragraph\n");
  });
});

describe("toYAML", () => {
  it("serializes an object", () => {
    const yaml = toYAML({ name: "Alice", age: 30 });
    assert.ok(yaml.includes("name: Alice"));
    assert.ok(yaml.includes("age: 30"));
  });

  it("serializes arrays", () => {
    const yaml = toYAML({ colors: ["red", "green"] });
    assert.ok(yaml.includes("- red"));
    assert.ok(yaml.includes("- green"));
  });
});

describe("detectFormat", () => {
  it("identifies JSON objects", () => {
    assert.equal(detectFormat('{"key": "value"}'), "json");
  });

  it("identifies JSON arrays", () => {
    assert.equal(detectFormat("[1, 2, 3]"), "json");
  });

  it("identifies YAML", () => {
    assert.equal(detectFormat("name: Alice\nage: 30"), "yaml");
  });

  it("identifies CSV", () => {
    assert.equal(detectFormat("name,age,city\nAlice,30,NYC"), "csv");
  });

  it("returns null for ambiguous input", () => {
    assert.equal(detectFormat("just some random text"), null);
  });
});
