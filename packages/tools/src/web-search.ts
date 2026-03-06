import { tool } from "ai";
import { z } from "zod";
import { getModel } from "@onera/ai";
import { generateText } from "ai";

/**
 * Exa search result shape
 */
interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string | null;
  author?: string | null;
  text?: string;
  highlights?: string[];
  summary?: string;
}

interface ExaSearchResponse {
  requestId: string;
  results: ExaResult[];
}

/**
 * Web search tool — uses Exa Search API for high-quality web results.
 *
 * Exa provides embeddings-based search with optional content extraction,
 * which is significantly better than traditional keyword search for
 * startup research, competitor analysis, and lead generation.
 *
 * Falls back to LLM knowledge when EXA_API_KEY is not set.
 *
 * Set EXA_API_KEY in .env to enable.
 */
export const webSearch = tool({
  description:
    "Search the web for current information about a topic. Returns a list of relevant results with titles, URLs, and content snippets.",
  parameters: z.object({
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
    const exaKey = process.env.EXA_API_KEY;

    // If Exa API key is available, use it
    if (exaKey) {
      try {
        const body: Record<string, unknown> = {
          query,
          numResults: maxResults,
          type: "auto",
          contents: {
            highlights: {
              maxCharacters: 3000,
            },
            summary: {
              query: "Main points and key information",
            },
          },
        };

        if (category) {
          body.category = category;
        }

        const res = await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "x-api-key": exaKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = (await res.json()) as ExaSearchResponse;
          const results = (data.results || []).map((r) => ({
            title: r.title || "",
            url: r.url || "",
            snippet: r.summary || (r.highlights || []).join(" ") || "",
            publishedDate: r.publishedDate || null,
            author: r.author || null,
          }));
          return { query, results, source: "exa" };
        }

        // Log the error but fall through to fallback
        const errorText = await res.text();
        console.warn(
          `[webSearch] Exa API returned ${res.status}: ${errorText}`
        );
      } catch (err) {
        console.warn("[webSearch] Exa API failed, falling back to LLM:", err);
      }
    }

    // Fallback: use LLM knowledge to provide search-like results
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
        const results = JSON.parse(text) as Array<{
          title: string;
          url: string;
          snippet: string;
        }>;
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
      return {
        query,
        results: [],
        source: "error",
        message: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});
