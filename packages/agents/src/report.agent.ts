import { generateObject } from "ai";
import { getModelForAgent } from "@onera/ai";
import { dailyReportOutputSchema } from "@onera/shared";

export interface ReportAgentInput {
  projectContext: string;
  completedTasks: string;
  failedTasks: string;
  pendingTasks: string;
  metrics: string;
  date: string;
}

/**
 * Daily Report Generator Agent
 *
 * Generates structured daily reports summarizing completed work,
 * upcoming tasks, and key metrics.
 */
export async function runReportAgent(input: ReportAgentInput) {
  const model = getModelForAgent("report");

  const { object } = await generateObject({
    model,
    schema: dailyReportOutputSchema,
    system:
      "You are a startup operations reporter. " +
      "Generate a concise, actionable daily report for the startup team. " +
      "\n\nReport format:" +
      "\n- Start with a brief executive summary" +
      "\n- List completed tasks with results" +
      "\n- Note any failures or blockers" +
      "\n- Outline tomorrow's priorities" +
      "\n- Include relevant metrics" +
      "\n- Use markdown formatting with bullet points (use * not -)" +
      "\n- Use checkmarks for completed items" +
      "\n- Keep it scannable and actionable" +
      "\n\nWriting style:" +
      "\n- NEVER use dashes (--), em-dashes, or en-dashes. Use periods, commas, or colons instead." +
      "\n- Use * for bullet points in markdown, not -" +
      "\n- Write naturally, like a real person writing a status update",
    prompt:
      `## Daily Report for ${input.date}\n\n` +
      `## Startup Context\n${input.projectContext}\n\n` +
      `## Completed Tasks\n${input.completedTasks || "No tasks completed today."}\n\n` +
      `## Failed Tasks\n${input.failedTasks || "No failures today."}\n\n` +
      `## Pending Tasks\n${input.pendingTasks || "No pending tasks."}\n\n` +
      `## Metrics\n${input.metrics || "No metrics available."}\n\n` +
      `Generate the daily operations report.`,
  });

  return object;
}
