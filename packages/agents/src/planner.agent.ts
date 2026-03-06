import { generateObject } from "ai";
import { getModelForAgent } from "@onera/ai";
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
  const model = getModelForAgent("planner");

  const { object } = await generateObject({
    model,
    schema: plannedTasksOutputSchema,
    system:
      "You are a startup operations planner, an AI COO. " +
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
      "\n- NEVER use dashes (--), em-dashes, or en-dashes in task titles or descriptions. Use periods, commas, or colons instead." +
      "\n- NEVER create tasks to 'set up social media accounts' or 'create profiles'. Assume the startup already has social media accounts configured." +
      "\n- NEVER suggest creating new accounts, registering domains, or setting up infrastructure" +
      "\n- Focus on content creation, research, outreach emails, competitive analysis, and engineering tasks" +
      "\n- Engineering tasks (agentName: engineer) should automate what a startup COO would want built:" +
      "\n  * Growth automation: SEO audit scripts, conversion funnel analysis, landing page performance scrapers, A/B test result analyzers, lead scoring calculators" +
      "\n  * Operational efficiency: report generators, data pipeline scripts, CRM data cleanup, workflow automation, KPI dashboard builders, churn analysis" +
      "\n  * Competitive intelligence: competitor pricing scrapers, feature comparison matrices, market size estimators, trend analysis scripts, review sentiment analyzers" +
      "\n- ENGINEERING tasks must produce actionable output the founder can use immediately (a report, a dataset, a working script, a visualization)" +
      "\n- Prefer tasks that save the founder hours of manual work or surface insights they wouldn't find on their own" +
      "\n\nTWITTER TASK guidelines:" +
      "\n- Twitter tasks are portfolio showcase tweets. We tweet FROM @onerachat ABOUT the onboarded startup." +
      "\n- Each tweet task should specify a SPECIFIC angle: a pain point the product solves, a feature highlight, or a user story" +
      "\n- Task descriptions must include the specific angle, e.g.: \"Tweet about how [product] solves [specific pain point] for [target users]\"" +
      "\n- DO NOT write generic tasks like \"Post a tweet about the company\" — be specific about the angle" +
      "\n- Good example: \"Tweet about how gym owners waste half their day on admin and GymPilot automates scheduling, retention, and payments\"" +
      "\n- Bad example: \"Create social media content for the startup\"",
    prompt:
      `## Startup Context\n${input.projectContext}\n\n` +
      `## Previous Tasks\n${input.previousTasks || "No previous tasks yet."}\n\n` +
      `## Completed Work\n${input.completedWork || "No completed work yet."}\n\n` +
      `## Current Metrics\n${input.currentMetrics || "No metrics available yet."}\n\n` +
      `Based on this context, generate the next batch of tasks for this startup.`,
  });

  return object;
}
