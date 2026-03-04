import type { FastifyInstance } from "fastify";
import { getAgentStatuses } from "../services/execution.service.js";
import { getRecentExecutionLogs } from "../services/execution.service.js";
import { getTaskMetrics } from "../services/task.service.js";
import { AGENT_DISPLAY_NAMES } from "@onera/agents";
import { prisma } from "@onera/database";

export async function agentRoutes(app: FastifyInstance) {
  // List all agent statuses
  app.get("/api/agents", async (_request, reply) => {
    const agents = await getAgentStatuses();
    return reply.send(agents);
  });

  // Get recent execution logs across all agents
  app.get<{ Querystring: { limit?: string } }>(
    "/api/agents/logs",
    async (request, reply) => {
      const limit = request.query.limit
        ? parseInt(request.query.limit, 10)
        : 50;
      const logs = await getRecentExecutionLogs(limit);
      return reply.send(logs);
    }
  );

  // Activity feed for the terminal bar — lightweight endpoint
  app.get<{ Querystring: { projectId?: string } }>(
    "/api/activity",
    async (request, reply) => {
      const { projectId } = request.query;

      // Get agent statuses
      const agents = await getAgentStatuses();

      // Get recent logs (last 10)
      const logs = await getRecentExecutionLogs(10);

      // Build terminal lines from real data
      const lines: string[] = [];

      // Active agents
      const runningAgents = agents.filter((a) => a.status === "running");
      if (runningAgents.length > 0) {
        for (const agent of runningAgents) {
          lines.push(`Running ${agent.displayName}...`);
        }
      }

      // Recent log entries
      for (const log of logs.slice(0, 8)) {
        const taskTitle =
          (log as { task?: { title?: string } }).task?.title || "task";
        const timeAgo = getTimeAgo(log.createdAt);
        if (log.status === "success") {
          lines.push(`${log.action} (${timeAgo})`);
        } else {
          lines.push(`FAILED: ${log.action} (${timeAgo})`);
        }
      }

      // If no activity yet, show system status
      if (lines.length === 0) {
        lines.push("System initialized");
        lines.push(`Agents: ${Object.keys(AGENT_DISPLAY_NAMES).join(", ")}`);

        if (projectId) {
          try {
            const metrics = await getTaskMetrics(projectId);
            lines.push(
              `Tasks: ${metrics.pending} pending, ${metrics.inProgress} running, ${metrics.completed} done`
            );
          } catch {
            // ignore
          }
        }

        lines.push("Awaiting tasks...");
      }

      return reply.send({ lines });
    }
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
