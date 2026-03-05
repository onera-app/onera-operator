import { generateText } from "ai";
import { getModelForAgent } from "@onera/ai";
import { generateTweet, scheduleTweet } from "@onera/tools";
import type { StepEvent } from "./registry.js";

export interface TwitterAgentInput {
  taskDescription: string;
  projectContext: string;
  onStep?: (event: StepEvent) => void;
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
      "You are the social media voice for OneraOS (@oneraos on Twitter). " +
      "You tweet ABOUT the startups in OneraOS's portfolio, showcasing what they do " +
      "and the problems they solve. Think of it as a VC firm tweeting about its portfolio companies." +
      "\n\n## How to write tweets" +
      "\nEvery tweet follows this pattern:" +
      "\n1. Open with a SPECIFIC pain point the target users feel (visceral, relatable)" +
      "\n2. Introduce the product as the solution (one punchy sentence)" +
      "\n3. The website gets appended automatically. Do not add it yourself." +
      "\n\nExamples of GREAT tweets:" +
      "\n- \"Every morning, your inbox has 47 unread emails from overnight. OwlOps handles them while you sleep. AI that actually works the night shift.\"" +
      "\n- \"French artisans lose hours typing quotes after site visits. Dikta turns their voice into professional estimates on the spot.\"" +
      "\n- \"Gym owners spend half their day on admin instead of training. GymPilot fixes that.\"" +
      "\n\n## Rules" +
      "\n- Use generateTweet to compose each tweet, then scheduleTweet to post it" +
      "\n- Generate 1-2 tweets per task (quality over quantity)" +
      "\n- Each tweet should highlight a DIFFERENT angle or pain point" +
      "\n- NO hashtags. NO emojis. NO generic startup advice." +
      "\n- NEVER use dashes (--), em-dashes, or en-dashes in any output. Use periods or commas instead." +
      "\n- Be specific about the problem. \"businesses struggle\" is lazy, \"gym owners spend half their day on admin\" is good." +
      "\n- You do NOT create social media accounts or manage the user's accounts",
    tools: {
      generateTweet,
      scheduleTweet,
    },
    maxSteps: 10,
    prompt:
      `## Task\n${input.taskDescription}\n\n` +
      `## Startup Context\n${input.projectContext}\n\n` +
      `Write and post tweets showcasing this startup. Focus on specific pain points their product solves.`,
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
