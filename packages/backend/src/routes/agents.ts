import type { FastifyInstance } from "fastify";
import { getAgentStatuses } from "../services/execution.service.js";
import { getRecentExecutionLogs } from "../services/execution.service.js";
import { getTaskMetrics, getPendingAutomatableTasks } from "../services/task.service.js";
import { enqueueTaskExecution } from "../queue/task.queue.js";
import { AGENT_DISPLAY_NAMES } from "@onera/agents";
import { prisma } from "@onera/database";
import { createActivitySubscriber, type AgentEvent } from "../services/activity.service.js";

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

      // Recent log entries (reverse so newest appears at the bottom)
      for (const log of logs.slice(0, 8).reverse()) {
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
          } catch (err: any) {
            console.warn("[agents] Failed to fetch task metrics:", err.message || err);
          }
        }

        lines.push("Awaiting tasks...");
      }

      return reply.send({ lines });
    }
  );

  // SSE stream for real-time agent activity events
  app.get<{ Querystring: { projectId?: string } }>(
    "/api/activity/stream",
    async (request, reply) => {
      const { projectId } = request.query;

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      // Send initial keepalive
      reply.raw.write(": connected\n\n");

      // ── Replay recent events so the feed doesn't start empty ──
      // Pull from execution logs + currently running tasks to build historical context.
      try {
        const recentLogs = await getRecentExecutionLogs(10);
        const runningTasks = await prisma.task.findMany({
          where: {
            status: "IN_PROGRESS",
            ...(projectId ? { projectId } : {}),
          },
          select: { id: true, title: true, agentName: true, projectId: true, updatedAt: true },
          take: 5,
        });

        // Replay recent completed/failed logs
        for (const log of recentLogs.slice().reverse()) {
          const task = (log as { task?: { title?: string; projectId?: string } }).task;
          if (projectId && task?.projectId && task.projectId !== projectId) continue;

          const replayEvent: AgentEvent = {
            type: log.status === "success" ? "completed" : "failed",
            agentName: log.agentName,
            taskId: log.taskId,
            taskTitle: task?.title || "task",
            projectId: projectId || "",
            message: log.action,
            timestamp: log.createdAt.toISOString(),
          };
          reply.raw.write(`data: ${JSON.stringify(replayEvent)}\n\n`);
        }

        // Show currently running tasks
        for (const task of runningTasks) {
          const runningEvent: AgentEvent = {
            type: "started",
            agentName: task.agentName || "unknown",
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.projectId,
            message: `${task.agentName || "Agent"} running: ${task.title}`,
            timestamp: task.updatedAt.toISOString(),
          };
          reply.raw.write(`data: ${JSON.stringify(runningEvent)}\n\n`);
        }
      } catch {
        // Replay is best-effort — don't break the stream
      }

      // Subscribe to Redis agent activity channel
      const { unsubscribe } = createActivitySubscriber((event) => {
        // Optionally filter by projectId
        if (projectId && event.projectId !== projectId) return;

        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Send keepalive every 15s to prevent timeout
      const keepalive = setInterval(() => {
        reply.raw.write(": keepalive\n\n");
      }, 15000);

      // Cleanup when client disconnects
      request.raw.on("close", () => {
        clearInterval(keepalive);
        unsubscribe();
      });
    }
  );

  // Trigger a specific agent — execute all its pending tasks for a project
  app.post<{
    Params: { name: string };
    Body: { projectId: string };
  }>("/api/agents/:name/trigger", async (request, reply) => {
    const { name } = request.params;
    const { projectId } = request.body || {};

    if (!projectId) {
      return reply.code(400).send({ error: "projectId is required" });
    }

    // Validate agent name
    const validAgents = ["twitter", "outreach", "research", "engineer"];
    if (!validAgents.includes(name)) {
      return reply.code(400).send({
        error: `Invalid agent: "${name}". Valid agents: ${validAgents.join(", ")}`,
      });
    }

    // Find all pending automatable tasks for this agent + project
    const allPending = await getPendingAutomatableTasks(projectId);
    const agentTasks = allPending.filter((t) => t.agentName === name);

    if (agentTasks.length === 0) {
      return reply.send({
        message: `No pending tasks for ${AGENT_DISPLAY_NAMES[name] ?? name}`,
        queued: 0,
      });
    }

    // Enqueue all of them
    for (const task of agentTasks) {
      await enqueueTaskExecution({
        taskId: task.id,
        projectId: task.projectId,
        agentName: task.agentName!,
        taskTitle: task.title,
        taskDescription: task.description,
      });
    }

    return reply.send({
      message: `Triggered ${agentTasks.length} task(s) for ${AGENT_DISPLAY_NAMES[name] ?? name}`,
      queued: agentTasks.length,
      agentName: name,
    });
  });
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
