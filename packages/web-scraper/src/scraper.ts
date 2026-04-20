/**
 * Regex-based HTML scraper for extracting clean text and structured data.
 * Uses only built-in Node.js APIs — zero external dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  /** Custom User-Agent string */
  userAgent?: string;
}

export interface Link {
  url: string;
  text: string;
}

export interface PageMetadata {
  title: string | null;
  description: string | null;
  ogImage: string | null;
  canonicalUrl: string | null;
  author: string | null;
}

export interface Heading {
  level: number;
  text: string;
}

export interface ScrapedPage {
  url: string;
  text: string;
  links: Link[];
  metadata: PageMetadata;
  headings: Heading[];
  fetchedAt: Date;
}

// ---------------------------------------------------------------------------
// HTML entity decoding
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "\u2014",
  ndash: "\u2013",
  laquo: "\u00AB",
  raquo: "\u00BB",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
  hellip: "\u2026",
  bull: "\u2022",
  middot: "\u00B7",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    )
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => {
      return NAMED_ENTITIES[name] ?? match;
    });
}

// ---------------------------------------------------------------------------
// Strip helpers
// ---------------------------------------------------------------------------

/** Remove an entire tag and its inner content (for script, style, etc.). */
function stripTagBlock(html: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[\\s>][\\s\\S]*?</${tag}>`,
    "gi",
  );
  return html.replace(re, " ");
}

/** Remove self-closing or void tags that match the given name. */
function stripSelfClosingTag(html: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*/?>`, "gi");
  return html.replace(re, " ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a URL and return the raw HTML body.
 */
export async function fetchPage(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const {
    timeout = 10_000,
    headers = {},
    userAgent = "AgentTools-WebScraper/0.1",
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
        ...headers,
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} for ${url}`,
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip HTML tags, decode entities, and normalize whitespace.
 * Removes script, style, nav, header, and footer element content.
 */
export function extractText(html: string): string {
  let text = html;

  // Remove full blocks we never want
  for (const tag of ["script", "style", "nav", "header", "footer", "noscript", "svg"]) {
    text = stripTagBlock(text, tag);
  }

  // Remove remaining HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  // Replace <br>, <p>, <div>, <li>, heading closes with newlines for readability
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote)>/gi, "\n");
  text = text.replace(/<(?:p|div|li|h[1-6]|tr|blockquote)\b[^>]*>/gi, "\n");

  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = decodeEntities(text);

  // Normalize whitespace: collapse spaces/tabs within lines, collapse blank lines
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Extract all `<a>` links with their text and resolved URLs.
 */
export function extractLinks(html: string, baseUrl?: string): Link[] {
  const anchorRegex = /<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi;
  const hrefRegex = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
  const links: Link[] = [];

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const rawText = match[2] ?? "";
    const hrefMatch = hrefRegex.exec(attrs);

    if (!hrefMatch) {
      continue;
    }

    const rawUrl = hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "";

    // Strip inner tags from link text
    const text = decodeEntities(rawText.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();

    let url = decodeEntities(rawUrl).trim();

    // Skip empty, javascript:, and anchor-only links
    if (!url || url.startsWith("javascript:") || url === "#") {
      continue;
    }

    // Resolve relative URLs
    if (baseUrl) {
      try {
        url = new URL(url, baseUrl).href;
      } catch {
        // If URL resolution fails, keep original
      }
    }

    links.push({ url, text });
  }

  return links;
}

/**
 * Extract page metadata: title, description, og:image, canonical URL, author.
 */
export function extractMetadata(html: string): PageMetadata {
  const getTag = (pattern: RegExp): string | null => {
    const m = pattern.exec(html);
    return m ? decodeEntities(m[1].trim()) : null;
  };

  const getMetaContent = (nameOrProperty: string): string | null => {
    // Match both name= and property= attributes, content can come before or after
    const patterns = [
      new RegExp(
        `<meta\\s+(?:name|property)\\s*=\\s*["']${nameOrProperty}["']\\s+content\\s*=\\s*["']([^"']*)["'][^>]*/?>`,
        "i",
      ),
      new RegExp(
        `<meta\\s+content\\s*=\\s*["']([^"']*)["']\\s+(?:name|property)\\s*=\\s*["']${nameOrProperty}["'][^>]*/?>`,
        "i",
      ),
    ];
    for (const p of patterns) {
      const m = p.exec(html);
      if (m) return decodeEntities(m[1].trim());
    }
    return null;
  };

  const title = getTag(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    getMetaContent("description") ?? getMetaContent("og:description");
  const ogImage = getMetaContent("og:image");
  const author = getMetaContent("author");

  // Canonical URL from <link rel="canonical">
  const canonicalMatch =
    /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*\/?>/i.exec(
      html,
    ) ??
    /<link\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["']canonical["'][^>]*\/?>/i.exec(
      html,
    );
  const canonicalUrl = canonicalMatch
    ? decodeEntities(canonicalMatch[1].trim())
    : null;

  return { title, description, ogImage, canonicalUrl, author };
}

/**
 * Extract h1-h6 headings with their level and text content.
 */
export function extractHeadings(html: string): Heading[] {
  // First remove script/style blocks to avoid false matches
  let cleaned = html;
  for (const tag of ["script", "style"]) {
    cleaned = stripTagBlock(cleaned, tag);
  }

  const headingRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Heading[] = [];

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(cleaned)) !== null) {
    const level = parseInt(match[1], 10);
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * All-in-one: fetch a URL and extract text, links, metadata, and headings.
 */
export async function scrape(
  url: string,
  options: FetchOptions = {},
): Promise<ScrapedPage> {
  const html = await fetchPage(url, options);
  const fetchedAt = new Date();

  return {
    url,
    text: extractText(html),
    links: extractLinks(html, url),
    metadata: extractMetadata(html),
    headings: extractHeadings(html),
    fetchedAt,
  };
}
