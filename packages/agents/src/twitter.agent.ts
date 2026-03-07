import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getModelForAgent } from "@onera/ai";
import { generateTweet } from "@onera/tools";
import { prisma } from "@onera/database";
import type { StepEvent } from "./registry.js";

export interface TwitterAgentInput {
  taskDescription: string;
  projectContext: string;
  projectId: string;
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

  const scheduleTweetForProject = tool({
    description: "Queue a tweet for manual posting on X/Twitter.",
    inputSchema: z.object({
      tweet: z.string().max(280).describe("The tweet text to queue (max 280 characters)"),
      tone: z.string().describe("The tone used (e.g. sharp, professional, casual). Use 'sharp' as default."),
    }),
    execute: async ({ tweet, tone }) => {
      const queued = await prisma.tweetQueue.create({
        data: {
          projectId: input.projectId,
          content: tweet,
          tone: tone,
        },
      });
      console.log(`[scheduleTweet] Tweet queued: ${queued.id}`);
      return {
        status: "queued",
        tweet,
        queueId: queued.id,
        platform: "twitter",
        message: "Tweet queued for admin review and manual posting.",
      };
    },
  });

  const result = await generateText({
    model,
    system:
      "You are the social media voice for Onera Operator (@onerachat on Twitter). " +
      "You tweet ABOUT the startups in Onera Operator's portfolio, showcasing what they do " +
      "and the problems they solve. Think of it as a VC firm tweeting about its portfolio companies." +
      "\n\n## How to write tweets" +
      "\nEvery tweet follows this pattern:" +
      "\n1. Open with a SPECIFIC pain point the target users feel (visceral, relatable)" +
      "\n2. Introduce the product as the solution (one punchy sentence)" +
      "\n3. Tag the founder's Twitter handle and/or the company's Twitter handle if available in the startup context" +
      "\n\nExamples of GREAT tweets:" +
      "\n- \"Every morning, your inbox has 47 unread emails from overnight. @OwlOps handles them while you sleep. AI that actually works the night shift. Built by @janesmith\"" +
      "\n- \"French artisans lose hours typing quotes after site visits. @DiktaApp turns their voice into professional estimates on the spot.\"" +
      "\n- \"Gym owners spend half their day on admin instead of training. @GymPilotHQ fixes that. cc @founderhandle\"" +
      "\n\n## Rules" +
      "\n- Use generateTweet to compose each tweet, then scheduleTweet to post it" +
      "\n- Generate 1-2 tweets per task (quality over quantity)" +
      "\n- Each tweet should highlight a DIFFERENT angle or pain point" +
      "\n- NO hashtags. NO emojis. NO generic startup advice." +
      "\n- NEVER include URLs or links in the tweet. No website links, no shortened URLs, nothing. Tag handles instead." +
      "\n- Tag the company's @handle and/or the founder's @handle when available in the startup context. This drives engagement and notifies them." +
      "\n- If no Twitter handles are in the context, just mention the company/founder by name (no @)." +
      "\n- NEVER use dashes (--), em-dashes, or en-dashes in any output. Use periods or commas instead." +
      "\n- Be specific about the problem. \"businesses struggle\" is lazy, \"gym owners spend half their day on admin\" is good." +
      "\n- You do NOT create social media accounts or manage the user's accounts",
    tools: {
      generateTweet,
      scheduleTweet: scheduleTweetForProject,
    },
    stopWhen: stepCountIs(10),
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
