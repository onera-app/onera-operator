import { tool } from "ai";
import { z } from "zod";
import { getModel } from "@onera/ai";
import { generateText } from "ai";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Web search tool — searches the web using Serper (Google Search API).
 *
 * Priority:
 *   1. Serper (Google results via SERPER_API_KEY) — fast, reliable, no rate limits at scale
 *   2. DuckDuckGo Lite HTML scraping — free fallback when Serper key is exhausted or unset
 *   3. LLM knowledge — last resort when both live search options fail
 *
 * Used by agents for startup research, competitor analysis, lead generation.
 */
export const webSearch = tool({
  description:
    "Search the web for current information about a topic. Returns a list of relevant results with titles, URLs, and content snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    maxResults: z
      .number()
      .min(1)
      .max(10)
      .describe("Maximum number of results to return. Use 5 for a standard search."),
    category: z
      .enum([
        "company",
        "research paper",
        "news",
        "tweet",
        "personal site",
        "financial report",
        "people",
        "none",
      ])
      .describe("Category to focus the search on. Use 'none' for general search."),
  }),
  execute: async ({ query, maxResults, category: rawCategory }) => {
    const category = rawCategory === "none" ? undefined : rawCategory;

    // Enhance query with category context for better results
    const searchQuery = category ? `${query} ${category}` : query;

    // 1. Try Serper (Google Search API) if key is available
    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey) {
      try {
        const results = await searchSerper(searchQuery, maxResults, serperKey);
        if (results.length > 0) {
          return { query, results, source: "serper" };
        }
        console.warn("[webSearch] Serper returned no results, falling back to DuckDuckGo");
      } catch (err) {
        console.warn("[webSearch] Serper search failed:", err instanceof Error ? err.message : err, "— falling back to DuckDuckGo");
      }
    }

    // 2. Fallback: DuckDuckGo Lite HTML scraping (no API key required)
    try {
      const results = await searchDuckDuckGo(searchQuery, maxResults);
      if (results.length > 0) {
        return { query, results, source: "duckduckgo" };
      }
      console.warn("[webSearch] DuckDuckGo returned no results, falling back to LLM");
    } catch (err) {
      console.warn("[webSearch] DuckDuckGo search failed:", err instanceof Error ? err.message : err);
    }

    // 3. Last resort: LLM knowledge
    try {
      const model = getModel();
      const { text } = await generateText({
        model,
        system:
          "You are a web search assistant. Given a query, provide the most relevant and up-to-date information you know. " +
          "Format your response as a JSON array of objects with 'title', 'snippet', and 'url' (use plausible URLs) fields. " +
          `Return at most ${maxResults} results. Return ONLY the JSON array, no other text.`,
        prompt: `Search query: "${query}"`,
      });

      try {
        const results = JSON.parse(text) as SearchResult[];
        return {
          query,
          results: Array.isArray(results) ? results.slice(0, maxResults) : [],
          source: "llm-knowledge",
        };
      } catch {
        return {
          query,
          results: [{ title: "Search Result", url: "", snippet: text }],
          source: "llm-knowledge",
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[webSearch] LLM fallback also failed:", message);
      return {
        query,
        results: [],
        source: "error",
        message: `Search failed: ${message}`,
      };
    }
  },
});

/**
 * Search via Serper.dev (Google Search API).
 * Docs: https://serper.dev/api-reference
 */
async function searchSerper(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Serper returned HTTP ${res.status}`);
    }

    const data = await res.json() as {
      organic?: Array<{ title: string; link: string; snippet?: string }>;
    };

    return (data.organic ?? []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet ?? "",
    }));
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Search DuckDuckGo via its lite HTML endpoint (no API key required).
 * Uses the lite version which works reliably without bot detection.
 * Parses result-link, result-snippet from the table-based HTML.
 */
async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`DuckDuckGo returned HTTP ${res.status}`);
    }

    const html = await res.text();
    return parseDuckDuckGoLite(html, maxResults);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Parse DuckDuckGo Lite results page.
 *
 * Structure (table-based):
 *   <a class='result-link' href="//duckduckgo.com/l/?uddg=ENCODED_URL">Title</a>
 *   <td class='result-snippet'>Snippet text with <b>bold</b> highlights</td>
 */
function parseDuckDuckGoLite(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Extract all result-link anchors
  // DDG lite format: <a rel="nofollow" href="..." class='result-link'>Title</a>
  // href comes BEFORE class in the actual HTML
  const linkRegex = /<a\s[^>]*href="([^"]+)"[^>]*class='result-link'[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /class='result-snippet'[^>]*>([\s\S]*?)<\/td>/g;

  const links: Array<{ url: string; title: string }> = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    const title = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, "").trim());

    // Decode DuckDuckGo redirect URL
    if (href.includes("uddg=")) {
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        href = decodeURIComponent(uddgMatch[1]);
      }
    }
    if (href && !href.startsWith("http")) {
      href = `https:${href}`;
    }

    if (title && href.startsWith("http")) {
      links.push({ url: href, title });
    }
  }

  // Extract all snippets
  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(
      decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim())
    );
  }

  // Combine links + snippets
  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || "",
    });
  }

  return results;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&\w+;/g, " ");
}
