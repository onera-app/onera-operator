import { Worker } from "bullmq";
import { getRedisConnection } from "../queue/connection.js";
import type { TaskExecutionJob } from "../queue/task.queue.js";
import { updateTaskStatus, getTaskCredits } from "../services/task.service.js";
import {
  createExecutionLog,
  upsertAgentStatus,
  incrementAgentTaskCount,
} from "../services/execution.service.js";
import {
  buildProjectContext,
  getProjectOwner,
  deductCredits,
} from "../services/project.service.js";
import { getExecutionAgent, AGENT_DISPLAY_NAMES } from "@onera/agents";

/**
 * Task Execution Worker
 *
 * Processes task execution jobs from the queue.
 * Picks the correct agent, runs it, and logs the results.
 */
export function startTaskWorker(): Worker<TaskExecutionJob> {
  const worker = new Worker<TaskExecutionJob>(
    "task-execution",
    async (job) => {
      const { taskId, projectId, agentName, taskTitle, taskDescription } =
        job.data;

      console.log(
        `[task-worker] Processing task "${taskTitle}" with agent "${agentName}"`
      );

      const displayName =
        AGENT_DISPLAY_NAMES[agentName] || agentName;

      // Mark agent as running
      await upsertAgentStatus(agentName, displayName, {
        status: "running",
        lastRunAt: new Date(),
        lastError: null,
      });

      // Check and deduct credits before executing
      const userId = await getProjectOwner(projectId);
      const taskCredits = await getTaskCredits(taskId);
      if (userId) {
        const deducted = await deductCredits(userId, taskCredits);
        if (!deducted) {
          console.log(
            `[task-worker] Insufficient credits for task "${taskTitle}"`
          );
          await updateTaskStatus(
            taskId,
            "FAILED",
            JSON.stringify({ error: "Insufficient credits" })
          );
          // Reset agent status — was set to "running" above
          await upsertAgentStatus(agentName, displayName, { status: "idle" });
          return;
        }
      }

      // Mark task as in progress
      await updateTaskStatus(taskId, "IN_PROGRESS");

      const startTime = Date.now();

      try {
        // Get the agent executor
        const executor = getExecutionAgent(agentName);
        if (!executor) {
          throw new Error(`No execution agent found for "${agentName}"`);
        }

        // Build project context for the agent
        const projectContext = await buildProjectContext(projectId);

        // Run the agent
        const result = await executor({
          taskDescription,
          projectContext,
        });

        const duration = Date.now() - startTime;

        // Log the execution
        await createExecutionLog({
          taskId,
          agentName,
          action: `Executed task: ${taskTitle}`,
          input: JSON.stringify({ taskDescription }),
          output: JSON.stringify({
            text: result.text,
            toolCalls: result.toolCalls,
          }),
          status: "success",
          duration,
        });

        // Mark task as completed
        await updateTaskStatus(
          taskId,
          "COMPLETED",
          JSON.stringify({
            text: result.text,
            steps: result.steps,
            toolResults: result.toolResults,
          })
        );

        // Update agent status
        await upsertAgentStatus(agentName, displayName, {
          status: "idle",
          lastRunAt: new Date(),
          lastError: null,
        });
        await incrementAgentTaskCount(agentName);

        console.log(
          `[task-worker] Completed task "${taskTitle}" in ${duration}ms`
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Log the failure
        await createExecutionLog({
          taskId,
          agentName,
          action: `Failed task: ${taskTitle}`,
          input: JSON.stringify({ taskDescription }),
          output: JSON.stringify({ error: errorMessage }),
          status: "error",
          duration,
        });

        // Mark task as failed
        await updateTaskStatus(
          taskId,
          "FAILED",
          JSON.stringify({ error: errorMessage })
        );

        // Update agent status
        await upsertAgentStatus(agentName, displayName, {
          status: "error",
          lastRunAt: new Date(),
          lastError: errorMessage,
        });

        console.error(
          `[task-worker] Failed task "${taskTitle}": ${errorMessage}`
        );
        throw error; // Re-throw for BullMQ retry logic
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );

  worker.on("error", (err) => {
    console.error("[task-worker] Worker error:", err.message);
  });

  console.log("[task-worker] Task execution worker started");
  return worker;
}
