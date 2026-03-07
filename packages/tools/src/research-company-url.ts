import { tool } from "ai";
import { z } from "zod";
import { generateText, type ModelMessage } from "ai";
import { getModel } from "@onera/ai";
import { webScraper } from "./web-scraper.js";

export const researchCompanyUrl = tool({
  description:
    "Research a company given its website URL. Fetches the actual website content, " +
    "then analyzes the company's product, target market, competitors, and generates " +
    "a comprehensive profile. Used when a new company is created to auto-populate context.",
  inputSchema: z.object({
    url: z.string().describe("The company website URL to research (must be a valid http/https URL)"),
    companyName: z.string().describe("The company name"),
  }),
  execute: async ({ url, companyName }) => {
    // Step 1: Fetch the actual website content
    let websiteContent = "";
    try {
      if (webScraper.execute) {
        const scraped = await webScraper.execute(
          { url, maxLength: 6000, deepCrawl: false },
          { toolCallId: "research-scrape", messages: [] as ModelMessage[] }
        );
        if (scraped && typeof scraped === "object" && "success" in scraped && scraped.success && "content" in scraped) {
          websiteContent = scraped.content as string;
        }
      }
    } catch (err) {
      console.warn(
        `[researchCompanyUrl] Could not fetch ${url}:`,
        err instanceof Error ? err.message : err
      );
    }

    // Step 2: Analyze with LLM (using real website content if available)
    const model = getModel();

    const websiteSection = websiteContent
      ? `\n\nActual website content:\n---\n${websiteContent}\n---`
      : "\n\n(Could not fetch website content. Infer from URL and name.)";

    const { text } = await generateText({
      model,
      system:
        "You are a startup research analyst. Given a company name, URL, and optionally " +
        "the actual content from their website, produce a comprehensive analysis.\n\n" +
        "Analyze:\n" +
        "- What the company does (product/service)\n" +
        "- Who their target users are\n" +
        "- Their value proposition\n" +
        "- Likely competitors (name 3-5)\n" +
        "- Business goals and growth priorities\n" +
        "- Business model\n\n" +
        "Format your response as JSON with these exact fields:\n" +
        '{ "description": "...", "product": "...", "targetUsers": "...", ' +
        '"competitors": ["...", "..."], "goals": ["...", "..."], "businessModel": "..." }\n\n' +
        "Be specific and actionable. Use the website content to ground your analysis in reality.",
      prompt: `Research this company:\nName: ${companyName}\nWebsite: ${url}${websiteSection}\n\nProvide the JSON analysis:`,
    });

    // Parse JSON from the response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If JSON parsing fails, return the raw text
    }

    return {
      description: text.trim(),
      product: "",
      targetUsers: "",
      competitors: [],
      goals: [],
      businessModel: "",
    };
  },
});
