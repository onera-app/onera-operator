import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "@onera/ai";

export const generateEmail = tool({
  description:
    "Generate a cold outreach email for the startup. Takes recipient info " +
    "and startup context, produces a personalized email.",
  parameters: z.object({
    recipientName: z.string().describe("Name of the recipient"),
    recipientRole: z.string().describe("Role or title of the recipient"),
    recipientCompany: z.string().describe("Company of the recipient"),
    startupContext: z
      .string()
      .describe("Startup name, product description, and value proposition"),
    purpose: z
      .enum(["partnership", "sales", "feedback", "introduction", "investment"])
      .describe("The purpose of the outreach"),
  }),
  execute: async ({
    recipientName,
    recipientRole,
    recipientCompany,
    startupContext,
    purpose,
  }) => {
    try {
      const model = getModel();
      const { text } = await generateText({
        model,
        system:
          "You are an expert at writing cold outreach emails for startups. " +
          "Write concise, personalized emails that get responses. " +
          "Keep subject lines under 50 characters. Keep the body under 150 words. " +
          "Be genuine, not salesy. Include a clear, low-commitment CTA. " +
          "Format: start with 'Subject: ...' on the first line, then a blank line, then the body.",
        prompt:
          `Startup context: ${startupContext}\n\n` +
          `Recipient: ${recipientName}, ${recipientRole} at ${recipientCompany}\n` +
          `Purpose: ${purpose}\n\n` +
          `Write the outreach email:`,
      });

      const lines = text.trim().split("\n");
      const firstLine = lines[0] || "";
      const subjectLine = /^Subject:/i.test(firstLine)
        ? firstLine.replace(/^Subject:\s*/i, "").trim()
        : firstLine.trim();
      const body = lines.slice(1).join("\n").trim();

      if (!subjectLine) {
        throw new Error("LLM did not generate a subject line");
      }

      return {
        success: true,
        subject: subjectLine,
        body,
        recipientName,
        recipientCompany,
        purpose,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[generateEmail] Failed to generate email:", message);
      return {
        success: false,
        subject: `Following up — ${purpose}`,
        body: `Hi ${recipientName},\n\nI wanted to reach out regarding a potential ${purpose} opportunity.\n\nWould you be open to a quick call?\n\nBest regards`,
        recipientName,
        recipientCompany,
        purpose,
        error: message,
      };
    }
  },
});
