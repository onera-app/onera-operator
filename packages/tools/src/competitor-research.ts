import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "@onera/ai";

export const competitorResearch = tool({
  description:
    "Analyze competitors based on the startup context. Produces a structured " +
    "competitive analysis with strengths, weaknesses, and opportunities.",
  inputSchema: z.object({
    startupContext: z
      .string()
      .describe("Startup name, product, and market description"),
    competitors: z
      .array(z.string())
      .describe("List of competitor names or URLs to analyze"),
    focusAreas: z
      .array(z.string())
      .describe("Specific areas to focus the analysis on (pricing, features, etc.). Pass an empty array if no specific focus."),
  }),
  execute: async ({ startupContext, competitors, focusAreas }) => {
    try {
      const model = getModel();
      const { text } = await generateText({
        model,
        system:
          "You are a startup competitive intelligence analyst. " +
          "Provide a structured, actionable competitive analysis. " +
          "Focus on what the startup can learn and do differently. " +
          "Be specific and avoid generic statements. " +
          "Format your response as a structured analysis with clear sections.",
        prompt:
          `Startup context: ${startupContext}\n\n` +
          `Competitors to analyze: ${competitors.join(", ")}\n` +
          `${focusAreas.length > 0 ? `Focus areas: ${focusAreas.join(", ")}` : ""}\n\n` +
          `Provide a competitive analysis:`,
      });

      return {
        analysis: text.trim(),
        competitorsAnalyzed: competitors,
        focusAreas,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[competitor-research] Error:", message);
      return {
        analysis: `Error generating competitive analysis: ${message}`,
        competitorsAnalyzed: competitors,
        focusAreas,
        error: message,
      };
    }
  },
});
