import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getModelForAgent } from "@onera/ai";

// AI SDK v6: StreamTextResult is invariant over its TOOLS generic, so the concrete tool set
// returned by streamText() cannot be widened to ToolSet in declaration emit without `any`.
// This is a known SDK limitation — the `any` here is intentional and safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamChatResult = ReturnType<typeof streamText<any, any>>;
import {
  createTaskManagerTools,
  webSearch,
} from "@onera/tools";

/**
 * Chat Agent
 *
 * Dashboard chat: a quick helping hand for the founder.
 * Does NOT execute tasks directly. Instead, creates tasks assigned to
 * the appropriate agent (planner, twitter, outreach, research, engineer)
 * so they go through the normal task queue.
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
    maxOutputTokens: 400,
    system:
      "You are Onera Operator, the AI COO for this startup. " +
      "You are a quick helping hand in the dashboard chat. Keep responses SHORT (2 to 4 sentences max). " +
      "Tell the user what's happening, what to change, which agent to use, or what to deploy.\n\n" +
      "## CRITICAL RULE: Never execute tasks directly\n" +
      "You do NOT have direct tools to send emails, post tweets, write code, or run research. " +
      "When a user asks you to do something, CREATE A TASK using createProjectTask and assign it to the right agent:\n" +
      "- Tweets/social media: assign to 'twitter' agent\n" +
      "- Outreach/cold emails: assign to 'outreach' agent\n" +
      "- Research/leads/competitors: assign to 'research' agent\n" +
      "- Code/scripts/engineering: assign to 'engineer' agent\n" +
      "- Planning/strategy: assign to 'planner' agent\n" +
      "Tell the user you've queued the task and which agent will handle it. " +
      "You can use listProjectTasks to check current task status and webSearch for quick lookups.\n\n" +
      "## Writing style\n" +
      "- Keep it brief: 2 to 4 sentences for advice, status, or guidance.\n" +
      "- NEVER use dashes (--), em-dashes, or en-dashes. Use periods, commas, or colons instead.\n" +
      "- Write naturally, like a real person.\n" +
      `\n\n## Startup Context\n${projectContext}`,
    messages,
    tools: {
      webSearch,
      ...taskTools,
    },
    stopWhen: stepCountIs(8),
  });
}
