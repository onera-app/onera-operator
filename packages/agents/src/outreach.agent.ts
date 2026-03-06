import { generateText } from "ai";
import { getModelForAgent } from "@onera/ai";
import { generateEmail, sendEmail, findLeads, notifyFounder } from "@onera/tools";
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
      "You are the COO of a startup, running outreach AUTONOMOUSLY on behalf of the founder. " +
      "You are an automated agent. You do NOT need human confirmation to send emails. " +
      "Your job is to generate AND send emails in one run.\n\n" +
      "When generating emails, you MUST always pass the full startup context, including the company name " +
      "and website URL, into the generateEmail tool's startupContext parameter. " +
      "Never send vague emails. Every email must clearly state who you are (COO of [Company Name]), " +
      "mention the recipient's company by name, and include your company URL.\n\n" +
      "## Writing style\n" +
      "NEVER use dashes (--), em-dashes, or en-dashes in any output. Use periods, commas, or colons instead.\n\n" +
      "## Workflow (follow this exactly)\n" +
      "1. Use findLeads to identify as many relevant targets as possible. Be ambitious. " +
      "If the task specifies a number, use that. Otherwise, aim for 10 to 20 leads per run.\n" +
      "2. For EACH lead, do a generate then send pair:\n" +
      "   a. Call generateEmail with the lead's info and full startup context\n" +
      "   b. Self-review the output: does it mention your company name + URL, the recipient's company, " +
      "and have a clear CTA? If not, call generateEmail again.\n" +
      "   c. Immediately call sendEmail with the generated subject and body. " +
      "ALWAYS set 'from' to the Company Email from the startup context (e.g. companyname@onera.app). " +
      "ALWAYS set 'replyTo' to the Founder Email from the startup context. " +
      "ALWAYS set 'projectId' to the Project ID from the startup context.\n" +
      "   d. If sendEmail returns 'rejected', fix the issues and retry once.\n" +
      "3. After sending all emails, use notifyFounder to update the founder.\n\n" +
      "IMPORTANT: You MUST call sendEmail after each generateEmail. Do NOT batch all generates first. " +
      "Generate one, send one, then move to the next lead. This keeps you within step limits.\n\n" +
      "Be strategic about who to reach out to and personalize each email. " +
      "If you have the recipient's company URL from findLeads, pass it as recipientCompanyUrl to generateEmail.\n\n" +
      "## Founder Notifications\n" +
      "After completing outreach, use notifyFounder to give the founder a quick update: " +
      "how many leads you found, how many emails went out, and anything notable. " +
      "Extract the Founder Email, Company Email, and Startup Name from the startup context.\n" +
      "Write it like a Slack message to your cofounder: casual, direct, no fluff. " +
      "Say 'sent 5 emails, 2 bounced' not 'I have successfully dispatched correspondence to 5 recipients'.",
    tools: {
      generateEmail,
      sendEmail,
      findLeads,
      notifyFounder,
    },
    maxSteps: 50,
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
