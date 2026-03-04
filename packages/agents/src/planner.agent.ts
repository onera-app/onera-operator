import { generateObject } from "ai";
import { getModel } from "@onera/ai";
import { plannedTasksOutputSchema } from "@onera/shared";

export interface PlannerInput {
  projectContext: string;
  previousTasks: string;
  completedWork: string;
  currentMetrics: string;
}

/**
 * Task Planner Agent
 *
 * Generates structured tasks based on the startup's context, previous work,
 * and current metrics. Uses structured output to ensure valid task objects.
 */
export async function runPlannerAgent(input: PlannerInput) {
  const model = getModel();

  const { object } = await generateObject({
    model,
    schema: plannedTasksOutputSchema,
    system:
      "You are a startup operations planner — an AI COO. " +
      "Your job is to analyze the startup's current state and generate " +
      "specific, actionable tasks that will drive growth and operations. " +
      "\n\nRules:" +
      "\n- Generate 3-7 tasks per planning cycle" +
      "\n- Prioritize based on impact and urgency" +
      "\n- Mark tasks as automatable if an agent can handle them" +
      "\n- Assign agentName for automatable tasks: twitter, outreach, research, or engineer" +
      "\n- Categories: GROWTH, MARKETING, OUTREACH, PRODUCT, ANALYTICS, OPERATIONS, RESEARCH, ENGINEERING, TWITTER" +
      "\n- Priorities: CRITICAL, HIGH, MEDIUM, LOW" +
      "\n- Don't repeat recently completed work" +
      "\n- Balance between quick wins and strategic initiatives" +
      "\n\nIMPORTANT constraints:" +
      "\n- NEVER create tasks to 'set up social media accounts' or 'create profiles' — we already have our own @oneraos Twitter account" +
      "\n- Twitter tasks should ONLY be about composing and posting tweets about the user's company from the @oneraos account" +
      "\n- NEVER suggest creating new accounts, registering domains, or setting up infrastructure" +
      "\n- Focus on content creation, research, outreach emails, competitive analysis, and engineering tasks" +
      "\n- Engineering tasks (agentName: engineer) can include: data analysis scripts, automation, web scraping, API integrations, analytics scripts" +
      "\n- ENGINEERING tasks are for technical automation work that can be executed as code",
    prompt:
      `## Startup Context\n${input.projectContext}\n\n` +
      `## Previous Tasks\n${input.previousTasks || "No previous tasks yet."}\n\n` +
      `## Completed Work\n${input.completedWork || "No completed work yet."}\n\n` +
      `## Current Metrics\n${input.currentMetrics || "No metrics available yet."}\n\n` +
      `Based on this context, generate the next batch of tasks for this startup.`,
  });

  return object;
}
