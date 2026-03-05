import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "@onera/ai";

export const generateTweet = tool({
  description:
    "Generate a tweet showcasing a startup from OneraOS's portfolio. " +
    "Produces a Polsia-style tweet: pain point → product solution, ending with the company website.",
  parameters: z.object({
    topic: z.string().describe("The specific angle, pain point, or product feature to highlight"),
    startupContext: z
      .string()
      .describe("Full startup context: name, product, target users, website, company email"),
    tone: z
      .enum(["sharp", "matter-of-fact", "bold", "empathetic"])
      .optional()
      .describe("The voice of the tweet (default: sharp)"),
  }),
  execute: async ({ topic, startupContext, tone }) => {
    const model = getModel();

    // Extract website from context for the sign-off
    const websiteMatch = startupContext.match(/Website:\s*(https?:\/\/\S+)/i);
    const website = websiteMatch?.[1]?.replace(/^https?:\/\//, "") || null;

    const { text } = await generateText({
      model,
      system:
        "You are the social media voice for OneraOS, an AI operating system that runs startups. " +
        "You write tweets showcasing the companies in our portfolio. " +
        "\n\nYour style (study these examples):" +
        "\n- \"Every morning, your inbox has 47 unread emails from overnight. OwlOps handles them while you sleep. AI that actually works the night shift.\"" +
        "\n- \"French artisans lose hours typing quotes after site visits. Dikta turns their voice into professional estimates on the spot.\"" +
        "\n- \"Most DeFi users check yields manually, rebalance manually, panic manually. YieldMind runs your portfolio like a fund manager that never sleeps.\"" +
        "\n- \"Gym owners spend half their day on admin instead of training. GymPilot fixes that. AI agents handle scheduling, retention, marketing, and payments while you coach.\"" +
        "\n\nRules:" +
        "\n- Start with the PAIN POINT the target users feel. Make it visceral and specific." +
        "\n- Then introduce the product as the solution in one punchy sentence." +
        "\n- Mention the company name naturally in the copy." +
        "\n- NO hashtags. NO emojis. NO generic startup advice." +
        "\n- NO quotes around the tweet. NO \"Check it out\" or \"Learn more\" CTAs." +
        "\n- NEVER use dashes (--), em-dashes, or en-dashes. Use periods or commas instead." +
        "\n- Keep it under 260 characters (leave room for the website line that gets appended)." +
        "\n- Write like a founder who built this, not a marketer selling it." +
        "\n- Be specific about the problem. \"Small businesses struggle\" is bad. \"Gym owners spend half their day on admin\" is good." +
        "\n- Output ONLY the tweet text, nothing else.",
      prompt:
        `Startup context:\n${startupContext}\n\n` +
        `Angle/topic: ${topic}\n` +
        `Tone: ${tone || "sharp"}\n\n` +
        `Write one tweet:`,
    });

    // Clean up and append website sign-off (like Polsia's "From companyname.polsia.app")
    let tweet = text.trim().replace(/^["']|["']$/g, "");

    if (website && !tweet.toLowerCase().includes(website.toLowerCase())) {
      const signoff = `\n\nFrom ${website}`;
      // Only append if it fits within 280 chars
      if (tweet.length + signoff.length <= 280) {
        tweet += signoff;
      }
    }

    return {
      tweet,
      characterCount: tweet.length,
      topic,
      tone: tone || "sharp",
    };
  },
});
