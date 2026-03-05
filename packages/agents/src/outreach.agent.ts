import { generateText } from "ai";
import { getModelForAgent } from "@onera/ai";
import { generateEmail, sendEmail, findLeads } from "@onera/tools";

export interface OutreachAgentInput {
  taskDescription: string;
  projectContext: string;
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
      "You are an outreach specialist for a startup. " +
      "Your job is to find potential leads, craft personalized outreach emails, and send them. " +
      "Use the findLeads tool first if you need to identify targets, " +
      "then generateEmail for each lead, then sendEmail to queue them. " +
      "Be strategic about who to reach out to and personalize each email.",
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
