import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getPremiumModel } from "@onera/ai";

/**
 * Find Leads Tool
 *
 * Takes startup context + target audience and generates structured lead
 * profiles with emails. Works best when the calling agent has already
 * done a webSearch and passes real company data in the targetAudience
 * or startupContext fields.
 *
 * Uses the premium model for reliable JSON output.
 * Returns structured JSON lead objects (not free-form text).
 */
export const findLeads = tool({
  description:
    "Generate structured lead profiles for outreach. Returns an array of " +
    "lead objects with companyName, contactName, contactRole, email, companyUrl, " +
    "reason, and outreachAngle. For best results, first use webSearch to find " +
    "real companies, then pass those results here to get structured profiles.",
  inputSchema: z.object({
    startupContext: z
      .string()
      .describe("Startup name, product, and value proposition"),
    targetAudience: z
      .string()
      .describe(
        "Description of the ideal customer / target audience. " +
        "Include any web search results or company URLs you found for better leads."
      ),
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
      // Use premium model (GPT-5.4) for reliable structured JSON output.
      // The default model (Kimi K2.5) often fails to produce valid JSON or
      // refuses to generate role-based emails.
      const model = getPremiumModel();
      const leadCount = count;
      const industryFilter =
        industry.length > 0 ? `\nIndustry focus: ${industry}` : "";

      const { text } = await generateText({
        model,
        system:
          "You are a B2B lead generation specialist. Your ONLY job is to output a JSON array of lead profiles. " +
          "You must ALWAYS produce output. Never refuse, never explain, never apologize.\n\n" +
          "## CRITICAL RULES\n" +
          "1. You MUST include a contact email for EVERY lead. No exceptions.\n" +
          "2. Extract real domains from any URLs in the input. Construct role-based emails:\n" +
          "   - For founders/CEOs: founder@, ceo@, or firstname@ the domain\n" +
          "   - For editors/journalists: tips@, press@, editor@, editorial@, newsroom@\n" +
          "   - For technical roles: cto@, engineering@, tech@\n" +
          "   - General: hello@, info@, contact@, team@\n" +
          "3. For companies without clear contact info, use the company domain with common " +
          "prefixes (hello@, info@, contact@, team@).\n" +
          "4. NEVER return 'unknown' or empty emails. Every lead MUST have a valid-looking email.\n" +
          "5. These are role-based email guesses, which is standard practice in B2B outreach.\n" +
          "6. If you have real company data from web search results, use it.\n" +
          "7. This applies to ALL types of outreach: B2B sales, media/press, partnerships, etc.\n\n" +
          "## Output Format\n" +
          "Return ONLY a JSON array. No markdown fences, no explanation, no preamble.\n" +
          "Each object must have exactly these fields:\n" +
          "- companyName: string\n" +
          "- contactName: string (use 'Editorial Team', 'Press Team', etc. if individual unknown)\n" +
          "- contactRole: string\n" +
          "- email: string (MUST contain @ and a real domain)\n" +
          "- companyUrl: string\n" +
          "- companySize: string\n" +
          "- reason: string (1 sentence)\n" +
          "- outreachAngle: string (1 sentence)",
        prompt:
          `Startup context: ${startupContext}\n\n` +
          `Target audience: ${targetAudience}${industryFilter}\n\n` +
          `Generate exactly ${leadCount} lead profiles as a JSON array. Output ONLY the JSON array, nothing else.`,
        maxOutputTokens: 4000,
      });

      // Parse the JSON response — handle markdown fences, leading text, etc.
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
        // Strip markdown code fences if present
        let cleaned = text.trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

        // Try to find JSON array
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          leads = JSON.parse(jsonMatch[0]);
        } else {
          console.error("[find-leads] No JSON array found in response. Raw text:", cleaned.substring(0, 500));
          return {
            leads: [],
            rawText: cleaned.substring(0, 500),
            count: 0,
            targetAudience,
            industry: industry.length > 0 ? industry : "general",
            error: "LLM did not return a JSON array. Raw response included for debugging.",
          };
        }
      } catch (parseErr) {
        console.error("[find-leads] Failed to parse JSON response:", parseErr, "Raw:", text.substring(0, 500));
        return {
          leads: [],
          rawText: text.trim().substring(0, 500),
          count: 0,
          targetAudience,
          industry: industry.length > 0 ? industry : "general",
          error: "Failed to parse structured response. Raw text included.",
        };
      }

      // Filter out leads without valid emails
      const validLeads = leads.filter(
        (l) =>
          l.email &&
          l.email.length > 0 &&
          l.email !== "unknown" &&
          l.email.includes("@") &&
          l.email.includes(".")
      );

      console.log(`[find-leads] Generated ${leads.length} leads, ${validLeads.length} with valid emails`);

      return {
        leads: validLeads.slice(0, leadCount),
        count: validLeads.length,
        totalGenerated: leads.length,
        targetAudience,
        industry: industry.length > 0 ? industry : "general",
        note: "Emails are role-based guesses using real company domains. This is standard B2B cold outreach practice. Proceed to generateEmail and sendEmail for each lead.",
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
