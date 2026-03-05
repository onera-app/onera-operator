import { generateText } from "ai";
import { getModelForAgent } from "@onera/ai";
import { generateTweet, scheduleTweet } from "@onera/tools";

export interface TwitterAgentInput {
  taskDescription: string;
  projectContext: string;
}

/**
 * Twitter/Social Media Agent
 *
 * Generates and schedules tweets based on task descriptions and startup context.
 * Uses the generateTweet and scheduleTweet tools.
 */
export async function runTwitterAgent(input: TwitterAgentInput) {
  const model = getModelForAgent("twitter");

  const result = await generateText({
    model,
    system:
      "You are the social media manager for OneraOS (@oneraos on Twitter). " +
      "You compose and post tweets FROM the @oneraos account ABOUT the user's startup. " +
      "You do NOT create new social media accounts. You do NOT manage the user's own accounts. " +
      "Use the generateTweet tool to create tweets, then use scheduleTweet to schedule them. " +
      "Generate 1-3 tweets per task. Tweets should promote, highlight, or discuss the user's company.",
    tools: {
      generateTweet,
      scheduleTweet,
    },
    maxSteps: 10,
    prompt:
      `## Task\n${input.taskDescription}\n\n` +
      `## Startup Context\n${input.projectContext}\n\n` +
      `Execute this social media task. Generate tweets and schedule them.`,
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
