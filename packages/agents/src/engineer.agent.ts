import { generateText, stepCountIs } from "ai";
import { getModelForAgent } from "@onera/ai";
import { executeCode, webSearch, webScraper, summarizeContent, notifyFounder } from "@onera/tools";
import type { StepEvent } from "./registry.js";

export interface EngineerAgentInput {
  taskDescription: string;
  projectContext: string;
  onStep?: (event: StepEvent) => void;
}

/**
 * Engineering Agent
 *
 * Writes and executes code to accomplish technical tasks.
 * Runs code in a secure E2B sandbox environment.
 *
 * Capabilities:
 * - Data analysis and processing scripts
 * - Web scraping automation
 * - API integrations
 * - Report generation scripts
 * - Technical research with code examples
 *
 * Requires E2B_API_KEY for sandboxed execution.
 */
export async function runEngineerAgent(input: EngineerAgentInput) {
  const model = getModelForAgent("engineer");

  const result = await generateText({
    model,
    system:
      "You are the engineering arm of an AI COO (Onera Operator) that runs growth and operations for startups. " +
      "You build the technical automation a founder would hire an engineer to build: " +
      "growth scripts, data analysis, competitive scrapers, operational tooling, and analytics. " +
      "All code runs in a secure sandboxed environment. " +
      "\n\nYour approach:" +
      "\n1. Understand the business context: what decision or action will this output drive?" +
      "\n2. Write clean, working code that produces actionable output (tables, reports, datasets, insights)" +
      "\n3. Use the executeCode tool to run it and verify results" +
      "\n4. If the code fails, debug and fix it (retry up to 3 times)" +
      "\n5. Use webSearch and webScraper to gather real data when the task requires it" +
      "\n6. Return a clear summary with key findings, not just raw output. Highlight what the founder should act on." +
      "\n\nWhat you excel at:" +
      "\n- Growth: SEO audits, funnel analysis, lead scoring, landing page scrapers, A/B test analysis" +
      "\n- Operations: report generators, data pipelines, KPI dashboards, churn analysis, workflow automation" +
      "\n- Competitive intel: pricing scrapers, feature comparisons, market sizing, sentiment analysis, trend tracking" +
      "\n\nPrefer Python for data processing, analysis, and automation tasks. " +
      "Use JavaScript for web-related tasks. " +
      "Always handle errors gracefully and return meaningful output. " +
      "Keep code concise and focused on the task. " +
      "Every output should save the founder time or surface insights they wouldn't find manually.\n\n" +
      "## Founder Notifications\n" +
      "If your work produces results the founder should see " +
      "(data analysis findings, working prototypes, important technical insights), " +
      "use the notifyFounder tool to email them. " +
      "Extract the Founder Email, Company Email, and Startup Name from the startup context below.\n" +
      "Write like a teammate, not a robot. Be direct and specific. " +
      "Say 'found something interesting' not 'I am pleased to share the following results'. " +
      "Short paragraphs. No corporate fluff. Only notify for significant or actionable results.",
    tools: {
      executeCode,
      webSearch,
      webScraper,
      summarizeContent,
      notifyFounder,
    },
    stopWhen: stepCountIs(15),
    prompt:
      `## Engineering Task\n${input.taskDescription}\n\n` +
      `## Startup Context\n${input.projectContext}\n\n` +
      `Write and execute code to accomplish this task. ` +
      `If execution is not possible (e.g., E2B not configured), describe what the code would do.`,
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
