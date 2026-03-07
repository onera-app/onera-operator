import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "@onera/ai";

export const summarizeContent = tool({
  description:
    "Summarize a piece of content (article, document, research). " +
    "Produces a concise summary with key takeaways.",
  inputSchema: z.object({
    content: z.string().describe("The content to summarize"),
    maxLength: z
      .enum(["short", "medium", "long"])
      .describe("Desired summary length. Use 'medium' for a balanced summary."),
    focusOn: z
      .string()
      .describe("Specific aspect to focus the summary on. Use an empty string for a general summary."),
  }),
  execute: async ({ content, maxLength, focusOn }) => {
    const model = getModel();
    const lengthGuide =
      maxLength === "short"
        ? "2-3 sentences"
        : maxLength === "long"
          ? "3-4 paragraphs"
          : "1-2 paragraphs";

    const { text } = await generateText({
      model,
      system:
        "You are an expert content summarizer. " +
        "Produce clear, concise summaries that capture the key points. " +
        "Include actionable takeaways when relevant.",
      prompt:
        `Summarize the following content in ${lengthGuide}.\n` +
        `${focusOn.length > 0 ? `Focus particularly on: ${focusOn}\n` : ""}\n` +
        `Content:\n${content}`,
    });

    return {
      summary: text.trim(),
      originalLength: content.length,
      summaryLength: text.trim().length,
    };
  },
});
