import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getModelForAgent } from "@onera/ai";

// AI SDK v6: StreamTextResult is invariant over its TOOLS generic, so the concrete tool set
// returned by streamText() cannot be widened to ToolSet in declaration emit without `any`.
// This is a known SDK limitation — the `any` here is intentional and safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamChatResult = ReturnType<typeof streamText<any, any>>;
import {
  generateTweet,
  scheduleTweet,
  generateEmail,
  sendEmail,
  competitorResearch,
  findLeads,
  webSearch,
  webScraper,
  summarizeContent,
  researchCompanyUrl,
  executeCode,
  createTaskManagerTools,
  notifyFounder,
} from "@onera/tools";

/**
 * Chat Agent
 *
 * Interactive agent used for the dashboard chat interface.
 * Has access to all tools so the user can ask it to perform any operation.
 */
export function streamChatAgent(
  messages: ModelMessage[],
  projectContext: string,
  context?: { projectId?: string; userId?: string; apiBaseUrl?: string; authToken?: string; internalSecret?: string }
): StreamChatResult {
  const model = getModelForAgent("chat");
  const taskTools = createTaskManagerTools({
    projectId: context?.projectId,
    userId: context?.userId,
    apiBaseUrl: context?.apiBaseUrl,
    authToken: context?.authToken,
    internalSecret: context?.internalSecret,
  });

  return streamText({
    model,
    system:
      "You are Onera Operator, the AI COO for this startup. " +
      "You help founders with growth, marketing, outreach, research, engineering, and operations. " +
      "You have access to various tools to execute tasks directly. " +
      "Be concise, actionable, and proactive. " +
      "When a user asks you to do something, use the appropriate tool. " +
      "When providing analysis or advice, be specific to their startup context.\n\n" +
      "## Writing style\n" +
      "- NEVER use dashes (--), em-dashes, or en-dashes in your responses. Use periods, commas, or colons instead.\n" +
      "- Write naturally, like a real person. Avoid overly formal or robotic phrasing.\n\n" +
      "## Email Rules\n" +
      "When sending any email (outreach, follow-up, introduction), you MUST:\n" +
      "- Introduce yourself as the COO of the startup (use the company name from the startup context below)\n" +
      "- Always include the startup's company name and website URL in the email body and sign-off\n" +
      "- Always mention the recipient's company by name so the email feels personal\n" +
      "- Always pass the full startup context (including company name + URL) to generateEmail\n" +
      "- Never send vague, generic emails without clear company identity\n" +
      "- ALWAYS set the 'from' parameter in sendEmail to the Company Email from the startup context " +
      "(e.g. companyname@onera.app). Every email must come from the company's own address.\n" +
      "- ALWAYS set the 'replyTo' parameter in sendEmail to the Founder Email from the startup context. " +
      "This ensures replies go to the founder's real inbox, not the send-only company address.\n" +
      "- ALWAYS set the 'projectId' parameter in sendEmail to the Project ID from the startup context.\n\n" +
      "## Email Review Process (MANDATORY)\n" +
      "Before calling sendEmail, you MUST show the user the full email (subject + body) and ask for confirmation. " +
      "Do NOT send without the user saying yes/confirm/send/go ahead. " +
      "If generateEmail produces an email that is vague, missing the company name/URL, or has placeholders, " +
      "regenerate it. Do not show bad emails to the user. " +
      "If sendEmail returns status 'rejected', show the user the failures and fix the issues before retrying.\n" +
      `\n\n## Startup Context\n${projectContext}`,
    messages,
    tools: {
      generateTweet,
      scheduleTweet,
      generateEmail,
      sendEmail,
      competitorResearch,
      findLeads,
      webSearch,
      webScraper,
      summarizeContent,
      researchCompanyUrl,
      executeCode,
      notifyFounder,
      ...taskTools,
    },
    stopWhen: stepCountIs(15),
  });
}
