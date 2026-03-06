import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "@onera/ai";

export const generateEmail = tool({
  description:
    "Generate a cold outreach email for the startup. Takes recipient info, " +
    "startup context (including company name and URL), and produces a personalized, " +
    "clearly structured email. The sender introduces themselves as the COO of the startup.",
  parameters: z.object({
    recipientName: z.string().describe("Name of the recipient"),
    recipientRole: z.string().describe("Role or title of the recipient"),
    recipientCompany: z.string().describe("Company of the recipient"),
    recipientCompanyUrl: z
      .string()
      .describe("Website URL of the recipient's company. Use an empty string if unknown."),
    startupContext: z
      .string()
      .describe(
        "Startup name, product description, value proposition, and website URL. " +
        "MUST include the company name and URL."
      ),
    purpose: z
      .enum(["partnership", "sales", "feedback", "introduction", "investment"])
      .describe("The purpose of the outreach"),
  }),
  execute: async ({
    recipientName,
    recipientRole,
    recipientCompany,
    recipientCompanyUrl,
    startupContext,
    purpose,
  }) => {
    try {
      const model = getModel();
      const { text } = await generateText({
        model,
        system: `You are the COO of a startup writing professional outreach emails.

## RULES (follow these exactly):

1. **Identify yourself clearly**: In the opening line, state your full name as "the COO of [Company Name]" and include the company URL in parentheses.
2. **Mention the recipient's company by name**: Reference their company name (and URL if provided) so the email feels researched and personal, not templated.
3. **State your company's value prop in one sentence**: Make it concrete. What you do, for whom, and why it matters.
4. **Keep it short**: Subject line under 50 characters. Body under 150 words. No fluff, no filler.
5. **Clear structure**:
   * Line 1: Who you are (name, title, company + URL)
   * Line 2-3: Why you're reaching out. Reference something specific about their company.
   * Line 4-5: Your value prop. What your company does and how it's relevant to them.
   * Line 6: One clear, low-commitment CTA (e.g., "Would a 15-min call next week work?")
   * Sign-off: Your name, title, company name, company URL
6. **Tone**: Professional, direct, genuine. Not salesy or gimmicky. No emojis.
7. **Format**: First line must be "Subject: ..." then a blank line, then the body.

## Writing style:
- NEVER use dashes (--), em-dashes, or en-dashes anywhere in the email. Use periods, commas, or colons instead.
- Write like a real person, not a marketing template.

## NEVER do this:
- Never send a vague email without mentioning your company name and URL
- Never skip the sign-off with company details
- Never write generic emails that could be from anyone`,
        prompt:
          `Startup context: ${startupContext}\n\n` +
          `Recipient: ${recipientName}, ${recipientRole} at ${recipientCompany}` +
          `${recipientCompanyUrl.length > 0 ? ` (${recipientCompanyUrl})` : ""}\n` +
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
        subject: `Following up: ${purpose}`,
        body: `Hi ${recipientName},\n\nI wanted to reach out regarding a potential ${purpose} opportunity.\n\nWould you be open to a quick call?\n\nBest regards`,
        recipientName,
        recipientCompany,
        purpose,
        error: message,
      };
    }
  },
});
