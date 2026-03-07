import { prisma, TaskStatus } from "@onera/database";
import { enqueueTaskExecution } from "../queue/task.queue.js";
import { upsertAgentStatus } from "./execution.service.js";
import { publishAgentEvent } from "./activity.service.js";
import { AGENT_DISPLAY_NAMES } from "@onera/agents";

/**
 * Stale Task Recovery Service
 *
 * Detects tasks stuck in IN_PROGRESS for too long and either retries them
 * or marks them as FAILED. Also resets orphaned agent statuses.
 *
 * Called on backend startup and periodically via setInterval.
 */

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes — tasks running longer are considered stale
const MAX_AUTO_RETRIES = 2; // Retry up to 2 times before marking FAILED
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

/**
 * Find and recover tasks stuck in IN_PROGRESS beyond the threshold.
 *
 * Recovery strategy:
 *   1. If retryCount < MAX_AUTO_RETRIES → reset to PENDING and re-enqueue
 *   2. Otherwise → mark as FAILED with a clear error message
 *
 * Also resets any agent statuses still marked "running" when no
 * IN_PROGRESS tasks exist for that agent.
 */
export async function recoverStaleTasks(): Promise<{
  retried: number;
  failed: number;
  agentsReset: number;
}> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const staleTasks = await prisma.task.findMany({
    where: {
      status: TaskStatus.IN_PROGRESS,
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      description: true,
      agentName: true,
      retryCount: true,
    },
  });

  if (staleTasks.length === 0) {
    // Still check for orphaned agent statuses
    const agentsReset = await resetOrphanedAgentStatuses();
    return { retried: 0, failed: 0, agentsReset };
  }

  console.log(
    `[stale-task] Found ${staleTasks.length} stale task(s) stuck in IN_PROGRESS`
  );

  let retried = 0;
  let failed = 0;

  for (const task of staleTasks) {
    const currentRetry = task.retryCount ?? 0;

    if (currentRetry < MAX_AUTO_RETRIES && task.agentName) {
      // ── Retry: reset to PENDING and re-enqueue ──
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.PENDING,
          retryCount: currentRetry + 1,
          result: JSON.stringify({
            error: `Auto-retried: task was stuck for over ${STALE_THRESHOLD_MS / 60000} minutes (attempt ${currentRetry + 1}/${MAX_AUTO_RETRIES})`,
          }),
        },
      });

      // Re-enqueue for execution
      await enqueueTaskExecution({
        taskId: task.id,
        projectId: task.projectId,
        agentName: task.agentName,
        taskTitle: task.title,
        taskDescription: task.description,
      });

      publishAgentEvent({
        type: "info",
        agentName: task.agentName,
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        message: `Auto-retrying stale task: ${task.title} (attempt ${currentRetry + 1}/${MAX_AUTO_RETRIES})`,
      });

      console.log(
        `[stale-task] Retrying "${task.title}" (attempt ${currentRetry + 1}/${MAX_AUTO_RETRIES})`
      );
      retried++;
    } else {
      // ── Exhausted retries: mark FAILED ──
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.FAILED,
          result: JSON.stringify({
            error: `Task timed out: stuck in IN_PROGRESS for over ${STALE_THRESHOLD_MS / 60000} minutes after ${currentRetry} auto-retries. The AI model call may have hung or the worker crashed.`,
          }),
        },
      });

      if (task.agentName) {
        publishAgentEvent({
          type: "failed",
          agentName: task.agentName,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          message: `Task timed out after ${currentRetry} retries: ${task.title}`,
          data: { error: "Exceeded stale task timeout" },
        });
      }

      console.log(
        `[stale-task] Marked "${task.title}" as FAILED after ${currentRetry} retries`
      );
      failed++;
    }
  }

  const agentsReset = await resetOrphanedAgentStatuses();

  console.log(
    `[stale-task] Recovery complete: ${retried} retried, ${failed} failed, ${agentsReset} agents reset`
  );

  return { retried, failed, agentsReset };
}

/**
 * Reset agent statuses that are stuck in "running" but have no
 * corresponding IN_PROGRESS tasks.
 */
async function resetOrphanedAgentStatuses(): Promise<number> {
  // Get all agents marked as running
  const runningAgents = await prisma.agentStatus.findMany({
    where: { status: "running" },
    select: { name: true, displayName: true },
  });

  if (runningAgents.length === 0) return 0;

  let resetCount = 0;

  for (const agent of runningAgents) {
    const inProgressCount = await prisma.task.count({
      where: {
        agentName: agent.name,
        status: TaskStatus.IN_PROGRESS,
      },
    });

    if (inProgressCount === 0) {
      const displayName =
        AGENT_DISPLAY_NAMES[agent.name] || agent.displayName || agent.name;
      await upsertAgentStatus(agent.name, displayName, {
        status: "idle",
        lastError: "Reset: was stuck in running state with no active tasks",
      });
      console.log(
        `[stale-task] Reset orphaned agent "${agent.name}" from running to idle`
      );
      resetCount++;
    }
  }

  return resetCount;
}

/**
 * Start the periodic stale task cleanup.
 * Call once during backend startup.
 */
export function startStaleTaskCleanup(): NodeJS.Timeout {
  // Run immediately on startup
  recoverStaleTasks().catch((err) => {
    console.error("[stale-task] Startup recovery failed:", err.message);
  });

  // Then run periodically
  const interval = setInterval(() => {
    recoverStaleTasks().catch((err) => {
      console.error("[stale-task] Periodic recovery failed:", err.message);
    });
  }, CLEANUP_INTERVAL_MS);

  console.log(
    `[stale-task] Stale task cleanup started (every ${CLEANUP_INTERVAL_MS / 60000} min, threshold: ${STALE_THRESHOLD_MS / 60000} min)`
  );

  return interval;
}
