import { generateText } from "ai";
import { getModel } from "@onera/ai";
import { prisma } from "@onera/database";

/**
 * Generates a human-readable markdown summary of a completed task result
 * using Kimi K2.5 (the default/cheap model), then stores it in the task's
 * `summary` field.
 *
 * This runs fire-and-forget after task completion — if it fails, the task
 * still has its raw result. The dashboard falls back to the raw result
 * if summary is null.
 */
export async function summarizeTaskResult(
  taskId: string,
  taskTitle: string,
  agentName: string,
  resultJson: string
): Promise<void> {
  try {
    const model = getModel();

    const { text } = await generateText({
      model,
      system:
        "You are writing a clean, human-readable summary for a startup operations dashboard. " +
        "Given a task title, agent name, and the raw JSON result from an autonomous AI agent, " +
        "produce a well-formatted markdown summary of what was accomplished.\n\n" +
        "## Rules\n" +
        "- Write in plain English like a team update, not a system log\n" +
        "- Use markdown formatting: **bold** for key numbers/names, bullet lists for multiple items\n" +
        "- Include specifics: who was emailed, what was researched, what was built, what was posted\n" +
        "- For outreach: list the recipients and companies, note any bounces or blocks\n" +
        "- For twitter: include the tweet text or topic\n" +
        "- For research: summarize the key findings\n" +
        "- For engineering: describe what was built or analyzed\n" +
        "- Keep it concise but complete. A few bullet points is perfect.\n" +
        "- Do NOT start with the agent name or 'Summary:'\n" +
        "- Do NOT include raw JSON, tool names, or technical IDs\n" +
        "- NEVER use dashes (--), em-dashes, or en-dashes. Use commas or periods instead.\n\n" +
        "## Example (outreach)\n" +
        "Sent **8 cold emails** to self-hosted AI infrastructure companies:\n" +
        "- engineering@byteforge.io\n" +
        "- ciso@medisynchealth.com\n" +
        "- infrastructure@cypherworks.security\n" +
        "- ...5 more\n\n" +
        "All emails included Conduit intro and free trial offer. No bounces.\n\n" +
        "## Example (twitter)\n" +
        "Queued **3 tweets** for this week:\n" +
        "- Thread on why self-hosted AI needs better auth\n" +
        "- Quick take on the new Ollama release\n" +
        "- Product tip: setting up SSO in under 5 minutes\n\n" +
        "## Example (research)\n" +
        "Analyzed **4 competitors** in the identity proxy space:\n" +
        "- **Pomerium**: strong open-source community, lacks AI features\n" +
        "- **Teleport**: enterprise focus, complex pricing\n\n" +
        "Key opportunity: none of them offer plug-and-play AI model auth.\n\n" +
        "## Example (engineer)\n" +
        "Built a **sentiment analysis script** for App Store reviews. " +
        "Processes the last 100 reviews and categorizes them by topic (performance, UX, pricing). " +
        "Found that 60% of negative reviews mention slow load times.",
      prompt:
        `Task: ${taskTitle}\n` +
        `Agent: ${agentName}\n` +
        `Result:\n${resultJson.substring(0, 4000)}`,
      maxOutputTokens: 400,
    });

    const summary = text.trim();

    if (summary.length > 0) {
      await prisma.task.update({
        where: { id: taskId },
        data: { summary },
      });
    }
  } catch (err) {
    // Non-critical — log and move on
    console.warn(
      `[summarizer] Failed to summarize task "${taskTitle}":`,
      err instanceof Error ? err.message : err
    );
  }
}
