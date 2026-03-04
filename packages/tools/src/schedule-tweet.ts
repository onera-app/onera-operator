import { tool } from "ai";
import { z } from "zod";
import { TwitterApi } from "twitter-api-v2";

/**
 * Schedule/Post Tweet Tool — posts to Twitter/X using the API v2.
 *
 * Requires Twitter API credentials:
 *   TWITTER_API_KEY, TWITTER_API_SECRET,
 *   TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET
 *
 * Falls back to a logged mock when credentials are not configured.
 */
export const scheduleTweet = tool({
  description:
    "Post a tweet to Twitter/X. Use this to publish content about the startup. " +
    "Requires TWITTER_API_KEY and related credentials for live posting.",
  parameters: z.object({
    tweet: z.string().max(280).describe("The tweet text to post (max 280 characters)"),
    scheduledTime: z
      .string()
      .optional()
      .describe("ISO datetime string for when to post (optional, posts immediately if omitted)"),
  }),
  execute: async ({ tweet, scheduledTime }) => {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

    const postTime = scheduledTime || new Date().toISOString();

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      console.log(
        `[scheduleTweet] Twitter credentials not set — would post:\n  Tweet: ${tweet}\n  Time: ${postTime}`
      );
      return {
        status: "scheduled",
        tweet,
        scheduledTime: postTime,
        platform: "twitter",
        message: "Tweet logged (not posted). Set TWITTER_API_KEY/SECRET/ACCESS_TOKEN to enable live posting.",
      };
    }

    try {
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken,
        accessSecret: accessTokenSecret,
      });

      // Post immediately (scheduled tweets require Twitter Premium API)
      const result = await client.v2.tweet(tweet);

      console.log(`[scheduleTweet] Tweet posted: ${result.data.id}`);
      return {
        status: "posted",
        tweet,
        tweetId: result.data.id,
        scheduledTime: postTime,
        platform: "twitter",
        url: `https://twitter.com/i/web/status/${result.data.id}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[scheduleTweet] Failed to post tweet:", message);
      return {
        status: "failed",
        tweet,
        scheduledTime: postTime,
        platform: "twitter",
        error: message,
      };
    }
  },
});
