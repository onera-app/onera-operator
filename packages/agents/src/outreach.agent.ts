import { generateText } from "ai";
import { getModelForAgent } from "@onera/ai";
import { generateEmail, sendEmail, findLeads } from "@onera/tools";
import type { StepEvent } from "./registry.js";

export interface OutreachAgentInput {
  taskDescription: string;
  projectContext: string;
  onStep?: (event: StepEvent) => void;
}

/**
 * Email Outreach Agent
 *
 * Generates personalized cold outreach emails, finds leads, and queues emails.
 * Uses the generateEmail, sendEmail, and findLeads tools.
 */
export async function runOutreachAgent(input: OutreachAgentInput) {
  const model = getModelForAgent("outreach");

  const result = await generateText({
    model,
    system:
      "You are the COO of a startup, running outreach on behalf of the founder. " +
      "When generating emails, you MUST always pass the full startup context, including the company name " +
      "and website URL, into the generateEmail tool's startupContext parameter. " +
      "Never send vague emails. Every email must clearly state who you are (COO of [Company Name]), " +
      "mention the recipient's company by name, and include your company URL.\n\n" +
      "## Writing style\n" +
      "NEVER use dashes (--), em-dashes, or en-dashes in any output. Use periods, commas, or colons instead.\n\n" +
      "## Workflow (follow this exactly)\n" +
      "1. Use findLeads to identify targets (if needed)\n" +
      "2. Use generateEmail for each lead — always include company name + URL in startupContext\n" +
      "3. **REVIEW before sending**: After generateEmail returns, carefully review the subject and body. " +
      "Check that the email:\n" +
      "   - Clearly states your name and title (COO) and your company name + URL\n" +
      "   - Mentions the recipient's company by name\n" +
      "   - Has a concrete value proposition (not generic fluff)\n" +
      "   - Has a clear, low-commitment CTA\n" +
      "   - Has a professional sign-off with company name + URL\n" +
      "   - Contains NO placeholder text like [Company Name] or [Your URL]\n" +
      "   If ANY of these checks fail, call generateEmail again with better context. Do NOT send a bad email.\n" +
      "4. Only after review passes, use sendEmail to deliver. " +
      "ALWAYS set the 'from' parameter to the Company Email from the startup context (e.g. companyname@onera.app). " +
      "This ensures the email comes from the company's own address, not a generic one.\n" +
      "5. If sendEmail returns status 'rejected', read the failures, fix the issues, and retry.\n\n" +
      "Be strategic about who to reach out to and personalize each email. " +
      "If you have the recipient's company URL from findLeads, pass it as recipientCompanyUrl to generateEmail.",
    tools: {
      generateEmail,
      sendEmail,
      findLeads,
    },
    maxSteps: 15,
    prompt:
      `## Task\n${input.taskDescription}\n\n` +
      `## Startup Context\n${input.projectContext}\n\n` +
      `Execute this outreach task. Find leads if needed, generate personalized emails, and send them.`,
    onStepFinish: (step) => {
      if (!input.onStep) return;
      if (step.text) {
        input.onStep({ type: "thinking", message: step.text });
      }
      for (const tc of step.toolCalls || []) {
        input.onStep({ type: "tool_call", message: `Using ${tc.toolName}`, data: tc.args });
      }
      for (const tr of step.toolResults || []) {
        input.onStep({ type: "tool_result", message: `${tr.toolName} done`, data: tr.result });
      }
    },
  });

  return {
    text: result.text,
    steps: result.steps.length,
    toolCalls: result.steps.flatMap((s) =>
      (s.toolCalls || []).map((tc) => ({
        tool: tc.toolName,
        args: tc.args,
      }))
    ),
    toolResults: result.steps.flatMap((s) =>
      (s.toolResults || []).map((tr) => ({
        tool: tr.toolName,
        result: tr.result,
      }))
    ),
  };
}
