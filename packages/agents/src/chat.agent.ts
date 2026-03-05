import { streamText, type Message } from "ai";
import { getModelForAgent } from "@onera/ai";
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
} from "@onera/tools";

/**
 * Chat Agent
 *
 * Interactive agent used for the dashboard chat interface.
 * Has access to all tools so the user can ask it to perform any operation.
 */
export function streamChatAgent(
  messages: Message[],
  projectContext: string,
  context?: { projectId?: string; userId?: string; apiBaseUrl?: string }
) {
  const model = getModelForAgent("chat");
  const taskTools = createTaskManagerTools({
    projectId: context?.projectId,
    userId: context?.userId,
    apiBaseUrl: context?.apiBaseUrl,
  });

  return streamText({
    model,
    system:
      "You are Onera Operator, an AI COO for startups. " +
      "You help founders with growth, marketing, outreach, research, engineering, and operations. " +
      "You have access to various tools to execute tasks directly. " +
      "Be concise, actionable, and proactive. " +
      "When a user asks you to do something, use the appropriate tool. " +
      "When providing analysis or advice, be specific to their startup context. " +
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
      ...taskTools,
    },
    maxSteps: 10,
  });
}
