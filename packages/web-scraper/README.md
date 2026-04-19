# @agent-tools/web-scraper

Extract clean text and structured data from web pages. Zero external runtime dependencies — uses only built-in Node.js APIs with regex-based HTML parsing.

## Install

```bash
npm install @agent-tools/web-scraper
```

## Usage

### Scrape a page (all-in-one)

```ts
import { scrape } from "@agent-tools/web-scraper";

const page = await scrape("https://example.com");
console.log(page.text);       // Clean text content
console.log(page.links);      // [{ url, text }, ...]
console.log(page.metadata);   // { title, description, ogImage, canonicalUrl, author }
console.log(page.headings);   // [{ level, text }, ...]
```

### Extract from existing HTML

```ts
import { extractText, extractLinks, extractMetadata, extractHeadings } from "@agent-tools/web-scraper";

const html = "<h1>Hello</h1><p>World &amp; friends</p>";

extractText(html);
// "Hello\nWorld & friends"

extractLinks('<a href="/about">About</a>', "https://example.com");
// [{ url: "https://example.com/about", text: "About" }]

extractMetadata('<head><title>My Page</title></head>');
// { title: "My Page", description: null, ogImage: null, canonicalUrl: null, author: null }

extractHeadings("<h1>Title</h1><h2>Section</h2>");
// [{ level: 1, text: "Title" }, { level: 2, text: "Section" }]
```

### Fetch options

```ts
import { fetchPage } from "@agent-tools/web-scraper";

const html = await fetchPage("https://example.com", {
  timeout: 5000,
  userAgent: "MyBot/1.0",
  headers: { Authorization: "Bearer token" },
});
```

## API

| Function | Description |
|---|---|
| `scrape(url, options?)` | Fetch + extract everything. Returns `ScrapedPage`. |
| `fetchPage(url, options?)` | Fetch raw HTML from a URL. |
| `extractText(html)` | Strip tags, decode entities, remove boilerplate elements. |
| `extractLinks(html, baseUrl?)` | Extract all links with resolved URLs. |
| `extractMetadata(html)` | Extract title, description, og:image, canonical, author. |
| `extractHeadings(html)` | Extract h1-h6 headings with level and text. |

## License

MIT
