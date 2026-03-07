import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "@onera/ai";

export const generateTweet = tool({
  description:
    "Generate a tweet showcasing a startup from Onera Operator's portfolio. " +
    "Produces a tweet following pain point to product solution pattern, tagging the founder/company handles.",
  inputSchema: z.object({
    topic: z.string().describe("The specific angle, pain point, or product feature to highlight"),
    startupContext: z
      .string()
      .describe("Full startup context: name, product, target users, Twitter handles, founder info"),
    tone: z
      .enum(["sharp", "matter-of-fact", "bold", "empathetic"])
      .describe("The voice of the tweet. Use 'sharp' for a punchy default."),
  }),
  execute: async ({ topic, startupContext, tone }) => {
    const model = getModel();

    // Extract Twitter handles from context for tagging
    const companyHandleMatch = startupContext.match(/(?:Company\s*)?Twitter(?:\s*Handle)?:\s*@?(\w{1,15})/i);
    const founderHandleMatch = startupContext.match(/Founder(?:'s)?\s*Twitter(?:\s*Handle)?:\s*@?(\w{1,15})/i);
    const companyHandle = companyHandleMatch ? `@${companyHandleMatch[1]}` : null;
    const founderHandle = founderHandleMatch ? `@${founderHandleMatch[1]}` : null;

    const handleContext = [
      companyHandle && `Company Twitter: ${companyHandle}`,
      founderHandle && `Founder Twitter: ${founderHandle}`,
    ].filter(Boolean).join("\n");

    const { text } = await generateText({
      model,
      system:
        "You are the social media voice for Onera Operator, an AI system that runs growth and operations for startups. " +
        "You write tweets showcasing the companies in our portfolio. " +
        "\n\nYour style (study these examples):" +
        "\n- \"Every morning, your inbox has 47 unread emails from overnight. @OwlOps handles them while you sleep. AI that actually works the night shift. Built by @janesmith\"" +
        "\n- \"French artisans lose hours typing quotes after site visits. @DiktaApp turns their voice into professional estimates on the spot.\"" +
        "\n- \"Most DeFi users check yields manually, rebalance manually, panic manually. @YieldMind runs your portfolio like a fund manager that never sleeps.\"" +
        "\n- \"Gym owners spend half their day on admin instead of training. @GymPilotHQ fixes that. cc @founderhandle\"" +
        "\n\nRules:" +
        "\n- Start with the PAIN POINT the target users feel. Make it visceral and specific." +
        "\n- Then introduce the product as the solution in one punchy sentence." +
        "\n- Tag the company's @handle and/or the founder's @handle when provided. This drives engagement and notifies them." +
        "\n- If no Twitter handles are available, just mention the company/founder by name (no @)." +
        "\n- NEVER include URLs or links. No website links, no shortened URLs, nothing. Tags over links." +
        "\n- NO hashtags. NO emojis. NO generic startup advice." +
        "\n- NO quotes around the tweet. NO \"Check it out\" or \"Learn more\" CTAs." +
        "\n- NEVER use dashes (--), em-dashes, or en-dashes. Use periods or commas instead." +
        "\n- Keep it under 280 characters." +
        "\n- Write like a founder who built this, not a marketer selling it." +
        "\n- Be specific about the problem. \"Small businesses struggle\" is bad. \"Gym owners spend half their day on admin\" is good." +
        "\n- Output ONLY the tweet text, nothing else.",
      prompt:
        `Startup context:\n${startupContext}\n\n` +
        (handleContext ? `Available Twitter handles:\n${handleContext}\n\n` : "") +
        `Angle/topic: ${topic}\n` +
        `Tone: ${tone}\n\n` +
        `Write one tweet:`,
    });

    // Clean up — no URL appending, just trim quotes
    const tweet = text.trim().replace(/^["']|["']$/g, "");

    return {
      tweet,
      characterCount: tweet.length,
      topic,
      tone,
      taggedHandles: [companyHandle, founderHandle].filter(Boolean),
    };
  },
});
