import { generateText, stepCountIs } from "ai";
import { getModelForAgent } from "@onera/ai";
import {
  generateEmail,
  sendEmail,
  findLeads,
  notifyFounder,
  webSearch,
  webScraper,
} from "@onera/tools";
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
      "1. FIRST, use webSearch to find REAL companies matching the target audience. " +
      "Search for companies in the right industry/niche. Do 1 to 3 searches with " +
      "different queries to get a good spread of results.\n" +
      "2. THEN, use findLeads and pass the web search results into the targetAudience field. " +
      "This converts raw search results into structured lead profiles with emails. " +
      "findLeads returns an array of lead objects, each with companyName, contactName, " +
      "contactRole, email, companyUrl, reason, and outreachAngle.\n" +
      "   If the task specifies a number, use that. Otherwise, find exactly 10 leads and send exactly 10 emails per run.\n" +
      "3. For EACH lead from the results, do a generate then send pair:\n" +
      "   a. Call generateEmail using the lead's email, contactName, companyName, companyUrl, " +
      "contactRole, and the full startup context. Pass the lead's companyUrl as recipientCompanyUrl.\n" +
      "   b. Self-review the output: does it mention your company name + URL, the recipient's company, " +
      "and have a clear CTA? If not, call generateEmail again.\n" +
      "   c. Immediately call sendEmail with the generated subject and body. " +
      "Set 'to' to the lead's email address from findLeads. " +
      "ALWAYS set 'from' to the Company Email from the startup context (e.g. companyname@onera.app). " +
      "ALWAYS set 'replyTo' to the Founder Email from the startup context. " +
      "ALWAYS set 'projectId' to the Project ID from the startup context.\n" +
      "   d. If sendEmail returns 'rejected', fix the issues and retry once.\n" +
      "4. After sending all emails, use notifyFounder to update the founder.\n\n" +
      "IMPORTANT: You MUST call sendEmail after each generateEmail. Do NOT batch all generates first. " +
      "Generate one, send one, then move to the next lead. This keeps you within step limits.\n\n" +
      "CRITICAL: Always use the email address from the findLeads result for each lead. " +
      "These are role-based email guesses using real company domains, which is standard B2B cold outreach practice. " +
      "DO NOT refuse to send because emails are 'unverified' or 'guessed'. They are valid role-based addresses " +
      "(e.g. founder@company.com, hello@company.com). If a lead has an email with an @ sign and a real company " +
      "domain, USE IT. Only skip leads where the email field is empty or literally 'unknown'.\n\n" +
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
      webSearch,
      webScraper,
    },
    stopWhen: stepCountIs(50),
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
        input.onStep({ type: "tool_call", message: `Using ${tc.toolName}`, data: tc.input });
      }
      for (const tr of step.toolResults || []) {
        input.onStep({ type: "tool_result", message: `${tr.toolName} done`, data: tr.output });
      }
    },
  });

  return {
    text: result.text,
    steps: result.steps.length,
    toolCalls: result.steps.flatMap((s) =>
      (s.toolCalls || []).map((tc) => ({
        tool: tc.toolName,
        args: tc.input,
      }))
    ),
    toolResults: result.steps.flatMap((s) =>
      (s.toolResults || []).map((tr) => ({
        tool: tr.toolName,
        result: tr.output,
      }))
    ),
  };
}
