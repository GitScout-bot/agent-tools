import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import {
  extractText,
  extractLinks,
  extractMetadata,
  extractHeadings,
} from "../scraper.js";

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------

describe("extractText", () => {
  it("strips tags and normalizes whitespace", () => {
    const html = "<p>Hello   <b>world</b></p>  <p>foo</p>";
    const text = extractText(html);
    strictEqual(text.includes("Hello world"), true);
    strictEqual(text.includes("foo"), true);
    // No leftover tags
    strictEqual(text.includes("<"), false);
  });

  it("removes script and style content", () => {
    const html = `
      <p>Visible text</p>
      <script>var x = "hidden";</script>
      <style>.hidden { display: none; }</style>
      <p>Also visible</p>
    `;
    const text = extractText(html);
    strictEqual(text.includes("Visible text"), true);
    strictEqual(text.includes("Also visible"), true);
    strictEqual(text.includes("hidden"), false);
    strictEqual(text.includes("display"), false);
  });

  it("decodes HTML entities", () => {
    const html = "<p>Tom &amp; Jerry &lt;3&gt; &quot;fun&quot;</p>";
    const text = extractText(html);
    strictEqual(text.includes('Tom & Jerry <3> "fun"'), true);
  });

  it("removes nav, header, and footer content", () => {
    const html = `
      <header><nav><a href="/">Home</a></nav></header>
      <main><p>Main content here</p></main>
      <footer><p>Copyright 2024</p></footer>
    `;
    const text = extractText(html);
    strictEqual(text.includes("Main content here"), true);
    strictEqual(text.includes("Home"), false);
    strictEqual(text.includes("Copyright"), false);
  });
});

// ---------------------------------------------------------------------------
// extractLinks
// ---------------------------------------------------------------------------

describe("extractLinks", () => {
  it("extracts href and text", () => {
    const html = `
      <a href="https://example.com">Example</a>
      <a href="https://test.org">Test Site</a>
    `;
    const links = extractLinks(html);
    strictEqual(links.length, 2);
    strictEqual(links[0].url, "https://example.com");
    strictEqual(links[0].text, "Example");
    strictEqual(links[1].url, "https://test.org");
    strictEqual(links[1].text, "Test Site");
  });

  it("resolves relative URLs when baseUrl is provided", () => {
    const html = `
      <a href="/about">About</a>
      <a href="contact.html">Contact</a>
      <a href="https://external.com">External</a>
    `;
    const links = extractLinks(html, "https://example.com/page/");
    strictEqual(links[0].url, "https://example.com/about");
    strictEqual(links[1].url, "https://example.com/page/contact.html");
    strictEqual(links[2].url, "https://external.com/");
  });

  it("skips javascript: and empty href links", () => {
    const html = `
      <a href="javascript:void(0)">JS Link</a>
      <a href="#">Anchor</a>
      <a href="https://real.com">Real</a>
    `;
    const links = extractLinks(html);
    strictEqual(links.length, 1);
    strictEqual(links[0].url, "https://real.com");
  });

  it("strips inner tags from link text", () => {
    const html = '<a href="/x"><strong>Bold</strong> link</a>';
    const links = extractLinks(html);
    strictEqual(links[0].text, "Bold link");
  });
});

// ---------------------------------------------------------------------------
// extractMetadata
// ---------------------------------------------------------------------------

describe("extractMetadata", () => {
  it("extracts title and description", () => {
    const html = `
      <html>
        <head>
          <title>My Page Title</title>
          <meta name="description" content="A page about things">
          <meta name="author" content="Jane Doe">
          <meta property="og:image" content="https://img.example.com/og.png">
          <link rel="canonical" href="https://example.com/page">
        </head>
        <body><p>Hello</p></body>
      </html>
    `;
    const meta = extractMetadata(html);
    strictEqual(meta.title, "My Page Title");
    strictEqual(meta.description, "A page about things");
    strictEqual(meta.author, "Jane Doe");
    strictEqual(meta.ogImage, "https://img.example.com/og.png");
    strictEqual(meta.canonicalUrl, "https://example.com/page");
  });

  it("returns null for missing fields", () => {
    const html = "<html><head></head><body></body></html>";
    const meta = extractMetadata(html);
    strictEqual(meta.title, null);
    strictEqual(meta.description, null);
    strictEqual(meta.ogImage, null);
    strictEqual(meta.canonicalUrl, null);
    strictEqual(meta.author, null);
  });

  it("falls back to og:description when description is missing", () => {
    const html = `
      <head>
        <meta property="og:description" content="OG description text">
      </head>
    `;
    const meta = extractMetadata(html);
    strictEqual(meta.description, "OG description text");
  });
});

// ---------------------------------------------------------------------------
// extractHeadings
// ---------------------------------------------------------------------------

describe("extractHeadings", () => {
  it("extracts h1-h6 with levels", () => {
    const html = `
      <h1>Main Title</h1>
      <h2>Section One</h2>
      <p>Some text</p>
      <h2>Section Two</h2>
      <h3>Subsection</h3>
      <h6>Deep heading</h6>
    `;
    const headings = extractHeadings(html);
    deepStrictEqual(headings, [
      { level: 1, text: "Main Title" },
      { level: 2, text: "Section One" },
      { level: 2, text: "Section Two" },
      { level: 3, text: "Subsection" },
      { level: 6, text: "Deep heading" },
    ]);
  });

  it("strips inner tags from heading text", () => {
    const html = '<h2><a href="/x">Linked <em>Heading</em></a></h2>';
    const headings = extractHeadings(html);
    strictEqual(headings.length, 1);
    strictEqual(headings[0].text, "Linked Heading");
    strictEqual(headings[0].level, 2);
  });

  it("ignores headings inside script blocks", () => {
    const html = `
      <h1>Real Heading</h1>
      <script>document.write("<h1>Fake</h1>");</script>
    `;
    const headings = extractHeadings(html);
    strictEqual(headings.length, 1);
    strictEqual(headings[0].text, "Real Heading");
  });
});
