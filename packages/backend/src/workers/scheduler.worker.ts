import { Worker } from "bullmq";
import { getRedisConnection } from "../queue/connection.js";
import type { SchedulerJob } from "../queue/scheduler.queue.js";
import { enqueueTaskExecution } from "../queue/task.queue.js";
import { prisma } from "@onera/database";
import { runPlannerAgent } from "@onera/agents";
import { AGENT_DISPLAY_NAMES } from "@onera/agents";
import { buildProjectContext } from "../services/project.service.js";
import {
  getRecentCompletedTasks,
  getPendingAutomatableTasks,
  getTaskMetrics,
  createManyTasks,
  listTasks,
} from "../services/task.service.js";
import { upsertAgentStatus } from "../services/execution.service.js";
import { ACTION_CREDITS } from "../services/billing.service.js";
import type { TaskCategory, TaskPriority } from "@onera/database";

/**
 * Scheduler Worker
 *
 * Runs the autonomous agent loop:
 * 1. Fetch project context
 * 2. Run planner agent to generate new tasks
 * 3. Find automatable tasks and enqueue them
 */
export function startSchedulerWorker(): Worker<SchedulerJob> {
  const worker = new Worker<SchedulerJob>(
    "agent-scheduler",
    async (job) => {
      const { type, projectId } = job.data;

      if (type === "agent-loop") {
        await runAgentLoop(projectId);
      }
      // daily-report jobs go to the report-scheduler queue (report.worker.ts)
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );

  worker.on("error", (err) => {
    console.error("[scheduler-worker] Worker error:", err.message);
  });

  console.log("[scheduler-worker] Scheduler worker started");
  return worker;
}

async function runAgentLoop(specificProjectId?: string) {
  console.log("[agent-loop] Starting agent loop cycle...");

  // Get all projects (or a specific one)
  const projects = specificProjectId
    ? await prisma.project.findMany({
        where: { id: specificProjectId },
      })
    : await prisma.project.findMany();

  if (projects.length === 0) {
    console.log("[agent-loop] No projects found. Skipping.");
    return;
  }

  for (const project of projects) {
    if (project.paused) {
      console.log(`[agent-loop] Skipping paused project: ${project.name}`);
      continue;
    }
    console.log(`[agent-loop] Processing project: ${project.name}`);

    try {
      // Update planner agent status
      await upsertAgentStatus(
        "planner",
        AGENT_DISPLAY_NAMES.planner || "Task Planner",
        { status: "running", lastRunAt: new Date() }
      );

      // Build context — pass the project object to avoid a redundant DB fetch
      const projectContext = await buildProjectContext(project);

      // Get recent tasks for context
      const recentTasks = await listTasks({ projectId: project.id });
      const completedTasks = await getRecentCompletedTasks(project.id, 10);
      const metrics = await getTaskMetrics(project.id);

      const previousTasksSummary =
        recentTasks.length > 0
          ? recentTasks
              .slice(0, 15)
              .map(
                (t) =>
                  `- [${t.status}] ${t.title} (${t.category}, ${t.priority})`
              )
              .join("\n")
          : "No previous tasks.";

      const completedWorkSummary =
        completedTasks.length > 0
          ? completedTasks
              .map((t) => {
                const summary = t.summary || "completed";
                return `- ${t.title}: ${summary}`;
              })
              .join("\n")
          : "No completed work yet.";

      const metricsSummary =
        `Tasks completed: ${metrics.completed}\n` +
        `Tasks pending: ${metrics.pending}\n` +
        `Tasks in progress: ${metrics.inProgress}\n` +
        `Tasks failed: ${metrics.failed}`;

      // Run planner agent
      const planResult = await runPlannerAgent({
        projectContext,
        previousTasks: previousTasksSummary,
        completedWork: completedWorkSummary,
        currentMetrics: metricsSummary,
      });

      // Save planned tasks
      if (planResult.tasks.length > 0) {
        await createManyTasks(
          planResult.tasks.map((t) => ({
            projectId: project.id,
            title: t.title,
            description: t.description,
            category: t.category as TaskCategory,
            priority: t.priority as TaskPriority,
            automatable: t.automatable,
            agentName: t.agentName || undefined,
            credits: t.agentName ? (ACTION_CREDITS[t.agentName] ?? 1) : 1,
          }))
        );

        console.log(
          `[agent-loop] Planned ${planResult.tasks.length} tasks for ${project.name}`
        );
      }

      // Update planner status
      await upsertAgentStatus(
        "planner",
        AGENT_DISPLAY_NAMES.planner || "Task Planner",
        { status: "idle", lastError: null }
      );

      // Enqueue automatable tasks
      const automatableTasks = await getPendingAutomatableTasks(project.id);

      for (const task of automatableTasks) {
        if (task.agentName) {
          await enqueueTaskExecution({
            taskId: task.id,
            projectId: project.id,
            agentName: task.agentName,
            taskTitle: task.title,
            taskDescription: task.description,
          });
        }
      }

      console.log(
        `[agent-loop] Enqueued ${automatableTasks.length} tasks for execution`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[agent-loop] Error processing project ${project.name}: ${errorMessage}`
      );

      await upsertAgentStatus(
        "planner",
        AGENT_DISPLAY_NAMES.planner || "Task Planner",
        { status: "error", lastError: errorMessage }
      );
    }
  }

  console.log("[agent-loop] Agent loop cycle complete");
}
