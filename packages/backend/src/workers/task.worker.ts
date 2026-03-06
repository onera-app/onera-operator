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
} from "../services/project.service.js";
import {
  deductCreditsForTask,
  canPostTweet,
  ACTION_CREDITS,
} from "../services/billing.service.js";
import { getExecutionAgent, AGENT_DISPLAY_NAMES } from "@onera/agents";
import { publishAgentEvent } from "../services/activity.service.js";

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

      // Tweet rate limit: 3 per day per project
      // Reverts to PENDING so the next scheduler cycle retries automatically.
      if (agentName === "twitter") {
        const allowed = await canPostTweet(projectId);
        if (!allowed) {
          console.log(
            `[task-worker] Tweet limit reached for project ${projectId}, deferring "${taskTitle}"`
          );
          await updateTaskStatus(taskId, "PENDING");
          await upsertAgentStatus(agentName, displayName, { status: "idle" });
          return;
        }
      }

      // Check and deduct credits — only on first attempt to avoid double-charging on retry.
      // If the user lacks credits, revert the task to PENDING so the next
      // scheduler cycle picks it up after they top up.
      if (job.attemptsMade === 0) {
        const userId = await getProjectOwner(projectId);
        const creditCost = ACTION_CREDITS[agentName] || await getTaskCredits(taskId);
        if (userId) {
          const result = await deductCreditsForTask(
            userId,
            creditCost,
            taskId,
            `${displayName}: ${taskTitle}`
          );
          if (!result.success) {
            console.log(
              `[task-worker] Insufficient credits (${result.remainingCredits}) for task "${taskTitle}" (needs ${creditCost}), deferring to PENDING`
            );
            await updateTaskStatus(taskId, "PENDING");
            await upsertAgentStatus(agentName, displayName, { status: "idle" });
            return;
          }
        }
      }

      // Mark task as in progress
      await updateTaskStatus(taskId, "IN_PROGRESS");

      const startTime = Date.now();

      // Publish: task started
      publishAgentEvent({
        type: "started",
        agentName,
        taskId,
        taskTitle,
        projectId,
        message: `${displayName} starting: ${taskTitle}`,
      });

      try {
        // Get the agent executor
        const executor = getExecutionAgent(agentName);
        if (!executor) {
          throw new Error(`No execution agent found for "${agentName}"`);
        }

        // Build project context for the agent
        const projectContext = await buildProjectContext(projectId);

        // Run the agent with step-level event publishing
        const result = await executor({
          taskDescription,
          projectContext,
          onStep: (stepEvent) => {
            publishAgentEvent({
              type: stepEvent.type === "thinking" ? "thinking"
                : stepEvent.type === "tool_call" ? "tool_call"
                : stepEvent.type === "tool_result" ? "tool_result"
                : "step",
              agentName,
              taskId,
              taskTitle,
              projectId,
              message: stepEvent.message,
              data: stepEvent.data,
            });
          },
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

        // Publish: task completed
        publishAgentEvent({
          type: "completed",
          agentName,
          taskId,
          taskTitle,
          projectId,
          message: `${displayName} completed: ${taskTitle}`,
          data: { duration, text: result.text?.slice(0, 300) },
        });

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

        // Publish: task failed
        publishAgentEvent({
          type: "failed",
          agentName,
          taskId,
          taskTitle,
          projectId,
          message: `${displayName} failed: ${taskTitle}`,
          data: { error: errorMessage, duration },
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
