import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "@onera/ai";

/**
 * Find Leads Tool
 *
 * Uses web search (Exa) to find real companies, then uses LLM to extract
 * structured lead profiles with contact emails. Falls back to LLM-only
 * generation when Exa is unavailable, but explicitly asks for emails.
 */
export const findLeads = tool({
  description:
    "Find potential outreach targets by searching the web for real companies " +
    "matching the target audience. Returns structured lead profiles with " +
    "company name, contact name, role, email, and outreach angle.",
  parameters: z.object({
    startupContext: z
      .string()
      .describe("Startup name, product, and value proposition"),
    targetAudience: z
      .string()
      .describe("Description of the ideal customer / target audience"),
    count: z
      .number()
      .min(1)
      .max(20)
      .describe(
        "Number of lead profiles to generate. Use 5 for a standard batch."
      ),
    industry: z
      .string()
      .describe(
        "Specific industry to target. Use an empty string for no specific industry filter."
      ),
  }),
  execute: async ({ startupContext, targetAudience, count, industry }) => {
    try {
      const model = getModel();
      const leadCount = count;
      const industryFilter =
        industry.length > 0 ? `\nIndustry focus: ${industry}` : "";

      // Step 1: Try web search for real companies
      let searchContext = "";
      const exaKey = process.env.EXA_API_KEY;

      if (exaKey) {
        try {
          const searchQuery = `${targetAudience} companies ${industry || ""} contact email`;
          const res = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
              "x-api-key": exaKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: searchQuery,
              numResults: Math.min(leadCount * 2, 20),
              type: "auto",
              category: "company",
              contents: {
                highlights: { maxCharacters: 2000 },
                summary: {
                  query: "company name, what they do, team, contact info",
                },
              },
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as {
              results: Array<{
                title: string;
                url: string;
                summary?: string;
                highlights?: string[];
              }>;
            };
            if (data.results?.length > 0) {
              searchContext = data.results
                .map(
                  (r, i) =>
                    `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.summary || (r.highlights || []).join(" ")}`
                )
                .join("\n\n");
            }
          }
        } catch (err) {
          console.warn("[find-leads] Exa search failed, using LLM only:", err);
        }
      }

      // Step 2: Generate structured leads with LLM
      const webContext =
        searchContext.length > 0
          ? `\n\n## Web Research Results\nUse these REAL companies from web search as your primary source. ` +
            `Extract or infer contact emails from the company domains (e.g., info@company.com, ` +
            `hello@company.com, or role-based like cto@company.com).\n\n${searchContext}`
          : "";

      const { text } = await generateText({
        model,
        system:
          "You are a B2B lead generation specialist. Generate structured lead profiles.\n\n" +
          "## CRITICAL RULES\n" +
          "1. You MUST include a contact email for EVERY lead. No exceptions.\n" +
          "2. For real companies from web search: use their actual domain to construct role-based emails " +
          "(e.g., founder@domain.com, hello@domain.com, info@domain.com, cto@domain.com)\n" +
          "3. For companies without clear contact info: use the company domain with common prefixes " +
          "(hello@, info@, contact@, team@)\n" +
          "4. NEVER return 'unknown' or empty emails. Every lead MUST have a valid-looking email.\n" +
          "5. Prefer specific role emails (cto@, founder@, engineering@) over generic ones.\n\n" +
          "## Output Format\n" +
          "Return a JSON array of objects. ONLY output the JSON array, no other text.\n" +
          "Each object must have exactly these fields:\n" +
          "- companyName: string (the company name)\n" +
          "- contactName: string (the contact person's name, or 'Team' if unknown)\n" +
          "- contactRole: string (their job title)\n" +
          "- email: string (their email address, MUST be a real-looking email with the company domain)\n" +
          "- companyUrl: string (the company website URL)\n" +
          "- companySize: string (e.g., '1-10', '11-50', '51-200', '200+')\n" +
          "- reason: string (why they are a good fit, 1 sentence)\n" +
          "- outreachAngle: string (suggested approach for the email, 1 sentence)",
        prompt:
          `Startup context: ${startupContext}\n\n` +
          `Target audience: ${targetAudience}${industryFilter}\n\n` +
          `Generate exactly ${leadCount} lead profiles as a JSON array.` +
          webContext,
        maxTokens: 3000,
      });

      // Parse the JSON response
      let leads: Array<{
        companyName: string;
        contactName: string;
        contactRole: string;
        email: string;
        companyUrl: string;
        companySize: string;
        reason: string;
        outreachAngle: string;
      }> = [];

      try {
        // Extract JSON from the response (handle markdown code blocks)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          leads = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.error(
          "[find-leads] Failed to parse JSON response:",
          parseErr
        );
        // Return the raw text as a fallback
        return {
          leads: [],
          rawText: text.trim(),
          count: 0,
          targetAudience,
          industry: industry.length > 0 ? industry : "general",
          source: searchContext.length > 0 ? "web+llm" : "llm",
          error: "Failed to parse structured response",
        };
      }

      // Filter out leads without emails
      const validLeads = leads.filter(
        (l) =>
          l.email &&
          l.email.length > 0 &&
          l.email !== "unknown" &&
          l.email.includes("@")
      );

      return {
        leads: validLeads.slice(0, leadCount),
        count: validLeads.length,
        targetAudience,
        industry: industry.length > 0 ? industry : "general",
        source: searchContext.length > 0 ? "web+llm" : "llm",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[find-leads] Error:", message);
      return {
        leads: [],
        count: 0,
        targetAudience,
        industry: industry.length > 0 ? industry : "general",
        error: message,
      };
    }
  },
});
