import { generateText, stepCountIs } from "ai";
import { getModelForAgent } from "@onera/ai";
import { competitorResearch, webSearch, webScraper, summarizeContent, notifyFounder } from "@onera/tools";
import type { StepEvent } from "./registry.js";

export interface ResearchAgentInput {
  taskDescription: string;
  projectContext: string;
  onStep?: (event: StepEvent) => void;
}

/**
 * Research Agent
 *
 * Analyzes competitors, researches markets, and summarizes findings.
 * Uses the competitorResearch, webSearch, and summarizeContent tools.
 */
export async function runResearchAgent(input: ResearchAgentInput) {
  const model = getModelForAgent("research");

  const result = await generateText({
    model,
    system:
      "You are a startup research analyst. " +
      "Your job is to conduct research on competitors, markets, and trends. " +
      "Use the competitorResearch tool for competitive analysis, " +
      "webSearch for finding information, webScraper for reading specific web pages, " +
      "and summarizeContent for distilling findings. " +
      "Provide actionable insights, not just data.\n\n" +
      "## Founder Notifications\n" +
      "After completing your research, if you found something the founder should know about " +
      "(competitive threats, market opportunities, important trends, or urgent findings), " +
      "use the notifyFounder tool to email them. " +
      "Extract the Founder Email, Company Email, and Startup Name from the startup context below.\n" +
      "Write the message like a smart coworker pinging the founder, not a corporate memo. " +
      "Be direct: lead with what matters, skip the filler. " +
      "Use short sentences. Say 'hey' not 'Dear Founder'. Say 'heads up' not 'I would like to inform you'. " +
      "Not every research task warrants an email: only notify when the findings are significant or time-sensitive.",
    tools: {
      competitorResearch,
      webSearch,
      webScraper,
      summarizeContent,
      notifyFounder,
    },
    stopWhen: stepCountIs(10),
    prompt:
      `## Task\n${input.taskDescription}\n\n` +
      `## Startup Context\n${input.projectContext}\n\n` +
      `Execute this research task. Analyze and provide actionable findings.`,
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
