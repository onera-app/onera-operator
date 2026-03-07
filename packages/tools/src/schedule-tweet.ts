import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@onera/database";

/**
 * Schedule Tweet Tool — queues a tweet for manual posting by an admin.
 *
 * Instead of posting directly to Twitter, this inserts into the TweetQueue
 * table with PENDING status. An admin reviews and posts manually via X.
 */
export const scheduleTweet = tool({
  description:
    "Queue a tweet for manual posting. The tweet will appear in the admin dashboard " +
    "for review and manual posting on X/Twitter.",
  inputSchema: z.object({
    tweet: z.string().max(280).describe("The tweet text to queue (max 280 characters)"),
    projectId: z.string().describe("The project ID this tweet belongs to"),
    tone: z.string().describe("The tone used to generate this tweet (e.g. sharp, bold, empathetic). Use 'sharp' as default."),
    scheduledTime: z
      .string()
      .describe("ISO datetime string for scheduling. Use an empty string for immediate queueing."),
  }),
  execute: async ({ tweet, projectId, tone }) => {
    const queued = await prisma.tweetQueue.create({
      data: {
        projectId,
        content: tweet,
        tone: tone || "sharp",
      },
    });

    console.log(`[scheduleTweet] Tweet queued for manual posting: ${queued.id}`);
    return {
      status: "queued",
      tweet,
      queueId: queued.id,
      platform: "twitter",
      message: "Tweet queued for admin review and manual posting.",
    };
  },
});
