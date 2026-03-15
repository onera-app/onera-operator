import { runTwitterAgent, type TwitterAgentInput } from "./twitter.agent.js";
import { runOutreachAgent, type OutreachAgentInput } from "./outreach.agent.js";
import { runResearchAgent, type ResearchAgentInput } from "./research.agent.js";
import { runEngineerAgent, type EngineerAgentInput } from "./engineer.agent.js";

export type StepEvent = {
  type: "thinking" | "tool_call" | "tool_result" | "text";
  message: string;
  data?: unknown;
};

export type AgentExecutionInput = {
  taskDescription: string;
  projectContext: string;
  projectId: string;
  onStep?: (event: StepEvent) => void;
};

export type AgentExecutionResult = {
  text: string;
  steps: number;
  toolCalls: Array<{ tool: string; args: unknown }>;
  toolResults: Array<{ tool: string; result: unknown }>;
};

type AgentExecutor = (
  input: AgentExecutionInput
) => Promise<AgentExecutionResult>;

/**
 * Registry of all execution agents.
 * Maps agent names to their runner functions.
 * The planner and report agents are not included here because
 * they have different input/output signatures and are called directly.
 */
const executionAgents: Record<string, AgentExecutor> = {
  twitter: (input: AgentExecutionInput) =>
    runTwitterAgent(input as TwitterAgentInput),
  outreach: (input: AgentExecutionInput) =>
    runOutreachAgent(input as OutreachAgentInput),
  research: (input: AgentExecutionInput) =>
    runResearchAgent(input as ResearchAgentInput),
  // engineer agent disabled — re-enable by uncommenting:
  // engineer: (input: AgentExecutionInput) =>
  //   runEngineerAgent(input as EngineerAgentInput),
};

export function getExecutionAgent(
  agentName: string
): AgentExecutor | undefined {
  return executionAgents[agentName.toLowerCase()];
}

export function listAgentNames(): string[] {
  return Object.keys(executionAgents);
}

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  planner: "Task Planner",
  twitter: "Twitter Agent",
  outreach: "Outreach Agent",
  research: "Research Agent",
  engineer: "Engineering Agent",
  report: "Report Generator",
  chat: "Chat Assistant",
};
