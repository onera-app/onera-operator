import { tool } from "ai";
import { z } from "zod";

/**
 * Web scraper tool — fetches a URL and extracts readable text content.
 *
 * Uses Crawl4AI when CRAWL4AI_API_URL is set (deep crawling, JS rendering,
 * anti-bot bypass). Falls back to a plain fetch-based extractor.
 *
 * Start Crawl4AI: docker run -p 11235:11235 unclecode/crawl4ai:latest
 * Then set in .env: CRAWL4AI_API_URL=http://localhost:11235
 */
export const webScraper = tool({
  description:
    "Fetch a web page URL and extract its text content. Handles JavaScript-rendered pages, " +
    "dynamic sites, and complex web apps. Use this to read websites, blog posts, " +
    "documentation, competitor pages, or any public URL.",
  parameters: z.object({
    url: z.string().url().describe("The URL to fetch"),
    maxLength: z
      .number()
      .describe("Maximum characters to return. Use 8000 for most pages."),
    deepCrawl: z
      .boolean()
      .describe("Enable deep crawling with JS rendering (uses Crawl4AI if available). Use false for simple pages."),
  }),
  execute: async ({ url, maxLength, deepCrawl }) => {
    const crawl4aiUrl = process.env.CRAWL4AI_API_URL;

    // Use Crawl4AI when available
    if (crawl4aiUrl) {
      const crawl4aiResult = await crawlWithCrawl4AI(url, maxLength, crawl4aiUrl);
      if (crawl4aiResult.success) {
        return crawl4aiResult;
      }
      console.warn(`[webScraper] Crawl4AI failed for ${url}: ${crawl4aiResult.error} — falling back to basic scraper`);
    }

    // Basic fetch-based scraper (fallback / when Crawl4AI is not configured)
    return crawlBasic(url, maxLength);
  },
});

/**
 * Crawl4AI integration — uses the Crawl4AI REST API for deep web crawling.
 * Handles JS rendering, dynamic content, and anti-bot measures.
 * Docs: https://docs.crawl4ai.com/
 */
async function crawlWithCrawl4AI(
  url: string,
  maxLength: number,
  crawl4aiUrl: string
): Promise<{
  url: string;
  success: boolean;
  content: string;
  error?: string;
  contentLength?: number;
  truncated?: boolean;
  source?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    // Submit crawl job
    const res = await fetch(`${crawl4aiUrl}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        urls: [url],
        priority: 10,
        crawler_params: {
          headless: true,
          word_count_threshold: 10,
          remove_overlay_elements: true,
          process_iframes: false,
        },
        extra: {
          only_text: true,
        },
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { url, success: false, content: "", error: `Crawl4AI HTTP ${res.status}` };
    }

    const data = (await res.json()) as { task_id?: string };
    if (!data.task_id) {
      return { url, success: false, content: "", error: "No task_id from Crawl4AI" };
    }

    // Poll for result (up to 55s)
    const taskId = data.task_id;
    const pollEnd = Date.now() + 55000;

    while (Date.now() < pollEnd) {
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await fetch(`${crawl4aiUrl}/task/${taskId}`);
      if (!pollRes.ok) continue;

      const pollData = (await pollRes.json()) as {
        status?: string;
        result?: {
          results?: Array<{
            success?: boolean;
            markdown?: string;
            fit_markdown?: string;
            error_message?: string;
          }>;
        };
      };

      if (pollData.status === "completed" && pollData.result?.results?.[0]) {
        const result = pollData.result.results[0];
        if (!result.success) {
          return {
            url,
            success: false,
            content: "",
            error: result.error_message || "Crawl4AI crawl failed",
          };
        }

        const text = result.fit_markdown || result.markdown || "";
        const trimmed = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

        return {
          url,
          success: true,
          content: trimmed,
          contentLength: text.length,
          truncated: text.length > maxLength,
          source: "crawl4ai",
        };
      }

      if (pollData.status === "failed") {
        return { url, success: false, content: "", error: "Crawl4AI task failed" };
      }
    }

    return { url, success: false, content: "", error: "Crawl4AI polling timeout (55s)" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      success: false,
      content: "",
      error: message.includes("abort") ? "Crawl4AI request timed out" : message,
    };
  }
}

/**
 * Basic fetch-based scraper — works without Crawl4AI.
 * Strips HTML tags and normalizes whitespace.
 */
async function crawlBasic(
  url: string,
  maxLength: number
): Promise<{
  url: string;
  success: boolean;
  content: string;
  error?: string;
  contentLength?: number;
  truncated?: boolean;
  source?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OneraBot/1.0; +https://onera.chat)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        url,
        success: false,
        content: "",
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const contentType = res.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/json") &&
      !contentType.includes("application/xml")
    ) {
      return {
        url,
        success: false,
        content: "",
        error: `Unsupported content type: ${contentType}`,
      };
    }

    const html = await res.text();
    const text = extractText(html);
    const trimmed = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    return {
      url,
      success: true,
      content: trimmed,
      contentLength: text.length,
      truncated: text.length > maxLength,
      source: "basic",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      url,
      success: false,
      content: "",
      error: message.includes("abort") ? "Request timed out after 15 seconds" : message,
    };
  }
}

/**
 * Basic HTML-to-text extraction.
 * Strips scripts, styles, tags, and normalizes whitespace.
 */
function extractText(html: string): string {
  let text = html;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  text = text.replace(
    /<\/?(?:div|p|h[1-6]|li|tr|br|hr|section|article|header|footer|nav|main|aside|blockquote|pre|ul|ol|table|thead|tbody|tfoot)[^>]*>/gi,
    "\n"
  );

  text = text.replace(/<[^>]+>/g, " ");

  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&\w+;/g, " ");

  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n\n");
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return text.trim();
}
